import { createHash } from "crypto";
import * as fsSync from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { createGunzip } from "zlib";

import type {
  IGameVersionArtifact,
  IGameVersionFingerprint,
} from "./types/IGameVersionTransitionProvider";

export function safePath(root: string, relativePath: string): string {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Unsafe game-version path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Game-version path escapes its root: ${relativePath}`);
  }
  return resolved;
}

export async function hashFile(filePath: string): Promise<{ hash: string; numBytes: number }> {
  return window.api.hash.compute("sha256", filePath);
}

export async function verifyFingerprint(root: string, fingerprint: IGameVersionFingerprint) {
  if (!Array.isArray(fingerprint?.files) || fingerprint.files.length === 0) {
    return false;
  }
  for (const file of fingerprint.files) {
    const filePath = safePath(root, file.path);
    const result = await hashFile(filePath);
    if (
      result.hash.toLowerCase() !== file.sha256.toLowerCase() ||
      (file.size !== undefined && result.numBytes !== file.size)
    ) {
      return false;
    }
  }
  return true;
}

export function fingerprintDigest(fingerprint: IGameVersionFingerprint): string {
  const entries = fingerprint.files
    .map((file) => `${file.path.replaceAll("\\", "/").toLowerCase()}\0${file.sha256.toLowerCase()}`)
    .sort();
  return createHash("sha256").update(entries.join("\n")).digest("hex");
}

export async function acquireArtifact(
  artifact: IGameVersionArtifact,
  cacheRoot: string,
): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.size < 0) {
    throw new Error("Invalid game-version artifact metadata");
  }
  const target = safePath(cacheRoot, artifact.sha256.toLowerCase());
  await fs.mkdir(cacheRoot, { recursive: true });
  try {
    const current = await hashFile(target);
    if (
      current.hash.toLowerCase() === artifact.sha256.toLowerCase() &&
      current.numBytes === artifact.size
    ) {
      return target;
    }
  } catch {
    // Missing or invalid cache entry: replace it below.
  }
  await fs.rm(target, { force: true });
  const url = new URL(artifact.url);
  if (url.protocol !== "https:") {
    throw new Error("Game-version artifacts must be served over HTTPS");
  }
  const partial = `${target}.partial-${crypto.randomUUID()}`;
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`Failed to download game-version artifact (${response.status})`);
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > artifact.size) {
    throw new Error("Game-version artifact exceeds its declared size");
  }
  let received = 0;
  let output: fs.FileHandle | undefined;
  const reader = response.body.getReader();
  try {
    output = await fs.open(partial, "wx");
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = Buffer.from(value);
      if (received + chunk.length > artifact.size) {
        throw new Error("Game-version artifact exceeds its declared size");
      }
      await writeBuffer(output, chunk, received);
      received += chunk.length;
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    await output?.close();
    await fs.rm(partial, { force: true });
    throw err;
  }
  await output.close();
  const downloaded = await hashFile(partial);
  if (
    downloaded.hash.toLowerCase() !== artifact.sha256.toLowerCase() ||
    downloaded.numBytes !== artifact.size
  ) {
    await fs.rm(partial, { force: true });
    throw new Error("Downloaded game-version artifact failed verification");
  }
  await fs.rename(partial, target);
  return target;
}

const CHUNK_MAP_MAGIC = Buffer.from("VGCMP1\0", "ascii");
const MAX_CHUNK_MAP_LITERAL = 16 * 1024 * 1024;
const MAX_CHUNK_MAP_COPY = 64 * 1024 * 1024;

class StreamReader {
  private mIterator: AsyncIterator<Buffer>;
  private mBuffered = Buffer.alloc(0);
  private mEnded = false;

  constructor(stream: AsyncIterable<Buffer | string>) {
    this.mIterator = stream[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  }

  public async read(length: number, allowEnd = false): Promise<Buffer | undefined> {
    while (this.mBuffered.length < length && !this.mEnded) {
      const next = await this.mIterator.next();
      this.mEnded = next.done === true;
      if (!this.mEnded) {
        const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
        this.mBuffered =
          this.mBuffered.length === 0 ? chunk : Buffer.concat([this.mBuffered, chunk]);
      }
    }
    if (this.mBuffered.length < length) {
      if (allowEnd && this.mBuffered.length === 0) {
        return undefined;
      }
      throw new Error("Chunk-map artifact ended unexpectedly");
    }
    const result = this.mBuffered.subarray(0, length);
    this.mBuffered = this.mBuffered.subarray(length);
    return result;
  }
}

async function copyRange(
  source: fs.FileHandle,
  output: fs.FileHandle,
  sourceOffset: number,
  outputOffset: number,
  length: number,
): Promise<void> {
  const buffer = Buffer.allocUnsafe(Math.min(length, 1024 * 1024));
  let copied = 0;
  while (copied < length) {
    const requested = Math.min(buffer.length, length - copied);
    const { bytesRead } = await source.read(buffer, 0, requested, sourceOffset + copied);
    if (bytesRead !== requested) {
      throw new Error("Chunk-map copy exceeds its source file");
    }
    await writeBuffer(output, buffer.subarray(0, bytesRead), outputOffset + copied);
    copied += bytesRead;
  }
}

async function writeBuffer(output: fs.FileHandle, data: Buffer, position: number): Promise<void> {
  let written = 0;
  while (written < data.length) {
    const result = await output.write(data, written, data.length - written, position + written);
    if (result.bytesWritten === 0) {
      throw new Error("Failed to write chunk-map output");
    }
    written += result.bytesWritten;
  }
}

/** Apply a gzip-compressed VGCMP1 stream without loading the source, target, or patch into memory. */
export async function applyChunkMap(
  sourcePath: string,
  patchPath: string,
  outputPath: string,
  targetSize: number,
): Promise<void> {
  const source = await fs.open(sourcePath, "r");
  const output = await fs.open(outputPath, "wx");
  const compressed = fsSync.createReadStream(patchPath);
  const uncompressed = compressed.pipe(createGunzip());
  const reader = new StreamReader(uncompressed);
  let outputOffset = 0;
  let succeeded = false;
  try {
    const magic = await reader.read(CHUNK_MAP_MAGIC.length);
    if (!magic?.equals(CHUNK_MAP_MAGIC)) {
      throw new Error("Invalid chunk-map artifact header");
    }
    while (true) {
      const opcode = (await reader.read(1))![0];
      if (opcode === 0xff) {
        break;
      }
      if (opcode === 0x00) {
        const header = (await reader.read(12))!;
        const sourceOffset = Number(header.readBigUInt64LE(0));
        const length = header.readUInt32LE(8);
        if (!Number.isSafeInteger(sourceOffset) || length === 0 || length > MAX_CHUNK_MAP_COPY) {
          throw new Error("Invalid chunk-map copy instruction");
        }
        if (outputOffset + length > targetSize) {
          throw new Error("Chunk-map output exceeds its declared size");
        }
        await copyRange(source, output, sourceOffset, outputOffset, length);
        outputOffset += length;
      } else if (opcode === 0x01) {
        const length = (await reader.read(4))!.readUInt32LE(0);
        if (length === 0 || length > MAX_CHUNK_MAP_LITERAL) {
          throw new Error("Invalid chunk-map literal instruction");
        }
        if (outputOffset + length > targetSize) {
          throw new Error("Chunk-map output exceeds its declared size");
        }
        const literal = (await reader.read(length))!;
        await writeBuffer(output, literal, outputOffset);
        outputOffset += literal.length;
      } else {
        throw new Error(`Unknown chunk-map opcode: ${opcode}`);
      }
    }
    if (outputOffset !== targetSize) {
      throw new Error("Chunk-map output has the wrong size");
    }
    if ((await reader.read(1, true)) !== undefined) {
      throw new Error("Chunk-map artifact has trailing data");
    }
    succeeded = true;
  } finally {
    compressed.destroy();
    uncompressed.destroy();
    await Promise.all([source.close(), output.close()]);
    if (!succeeded) {
      await fs.rm(outputPath, { force: true });
    }
  }
}
