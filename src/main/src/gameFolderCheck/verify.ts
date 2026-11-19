/**
 * Checks Steam's files against the depot manifests. Works from the manifests alone, so it runs
 * alongside the folder walk. Where Vortex deployed over a Steam file, the original is in
 * `<file>.vortex_backup` and that is what gets checked.
 *
 * Every file's size is checked by path, which doesn't make antivirus scan it. Opening a file to
 * hash it costs a scan of ~5 ms per file (far more for executables) on a cold cache, so only a
 * random sample of the same-size files is hashed, executables and the rest capped separately.
 */
import { createHash } from "node:crypto";
import { open, stat, type FileHandle } from "node:fs/promises";

import type {
  GameFolderCheckLimits,
  GameFolderDetection,
  GameFolderPartStatus,
} from "@vortex/shared/ipc";

import { diskPath, type IBaseline } from "./baseline";
import { DEPOT_FLAG, type IDepotChunk, type IDepotFile } from "./depotManifest";

export const BACKUP_SUFFIX = ".vortex_backup";

const CHUNK_BUFFER_SIZE = 1024 * 1024;
const SAMPLED_CHUNKS = 4;
const SIZE_CHECK_CONCURRENCY = 16;
const EXECUTABLE = /\.(exe|dll)$/i;
// Steam's own verify doesn't restore these either
const NOT_COMPARED = DEPOT_FLAG.userConfig | DEPOT_FLAG.versionedUserConfig | DEPOT_FLAG.symlink;

export type VerifyOutcome =
  | { kind: "verified" }
  | {
      kind: "modified";
      by: GameFolderDetection;
      diskSize: number;
      /** full verify: the chunk sample would have missed it */
      chunkSampleWouldMiss: boolean;
      /** full verify: the file sample wouldn't have picked it */
      fileSampleWouldMiss: boolean;
    }
  /** same size as Steam's, not picked for hashing */
  | { kind: "size_matched" }
  /** neither the file nor a backup of it exists */
  | { kind: "absent" }
  | { kind: "unreadable" }
  | { kind: "not_compared" }
  /** not reached before a limit stopped verification */
  | { kind: "unchecked" };

export interface IVerification {
  status: GameFolderPartStatus;
  /** Keyed like `IBaseline.files` */
  outcomes: Map<string, VerifyOutcome>;
  /** files picked for hashing, and whether either sample was capped */
  hashSample: { files: number; capped: boolean };
  bytesRead: number;
}

export interface IVerifyOptions {
  fullVerify: boolean;
  limits: GameFolderCheckLimits;
  /** When the check started; `maxDurationMs` counts from here */
  startedAt: number;
  signal: AbortSignal;
  random?: () => number;
}

class LimitReached extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`game folder check limit reached: ${reason}`);
    this.reason = reason;
  }
}

/** First, last and two from the middle; every chunk when that's no fewer. */
export function sampledChunkIndices(count: number): Set<number> {
  if (count <= SAMPLED_CHUNKS) {
    return new Set(Array.from({ length: count }, (_, index) => index));
  }
  return new Set([0, Math.floor(count / 3), Math.floor((2 * count) / 3), count - 1]);
}

/** Up to `max` entries picked uniformly at random (partial Fisher-Yates); mutates `items`. */
function pickRandom<T>(items: T[], max: number, random: () => number): T[] {
  const take = Math.min(max, items.length);
  for (let index = 0; index < take; index++) {
    const pick = index + Math.floor(random() * (items.length - index));
    [items[index], items[pick]] = [items[pick]!, items[index]!];
  }
  return items.slice(0, take);
}

/**
 * Which same-size files to hash: up to `maxExecutables` executables, then up to `maxOthers` of
 * the rest, both at random. Executables come first, so a limit cuts the sample before them.
 */
export function chooseFilesToHash<T extends { name: string }>(
  candidates: readonly T[],
  maxExecutables: number,
  maxOthers: number,
  random: () => number,
): { chosen: T[]; capped: boolean } {
  const executables = candidates.filter((file) => EXECUTABLE.test(file.name));
  const others = candidates.filter((file) => !EXECUTABLE.test(file.name));
  const chosen = [
    ...pickRandom(executables, maxExecutables, random),
    ...pickRandom(others, maxOthers, random),
  ];
  return { chosen, capped: chosen.length < candidates.length };
}

const errorCode = (err: unknown): string | undefined => (err as { code?: string })?.code;

interface ISized {
  key: string;
  file: IDepotFile;
  /** the backup when there is one, else the file */
  path: string;
}

class Verifier {
  bytesRead = 0;
  readonly #options: IVerifyOptions;

  constructor(options: IVerifyOptions) {
    this.#options = options;
  }

  /** Throws when cancelled or out of budget; checked before every file and every read. */
  checkBudget(): void {
    this.#options.signal.throwIfAborted();
    const { limits, startedAt } = this.#options;
    if (this.bytesRead >= limits.maxBytes) throw new LimitReached("max_bytes");
    if (Date.now() - startedAt >= limits.maxDurationMs) throw new LimitReached("max_duration");
  }

  /** The size check, by path: no file is opened, so no antivirus scan. */
  async checkSize(
    gamePath: string,
    file: IDepotFile,
  ): Promise<VerifyOutcome | { kind: "sized"; path: string }> {
    if ((file.flags & NOT_COMPARED) !== 0 || file.linkTarget !== "") {
      return { kind: "not_compared" };
    }
    this.checkBudget();
    const filePath = diskPath(gamePath, file.name);
    for (const candidate of [filePath + BACKUP_SUFFIX, filePath]) {
      try {
        // in order: the backup, when there is one, is the original
        // oxlint-disable-next-line no-await-in-loop
        const { size } = await stat(candidate);
        if (size === file.size) return { kind: "sized", path: candidate };
        return {
          kind: "modified",
          by: "size",
          diskSize: size,
          chunkSampleWouldMiss: false,
          fileSampleWouldMiss: false,
        };
      } catch (err) {
        if (errorCode(err) !== "ENOENT") return { kind: "unreadable" };
      }
    }
    return { kind: "absent" };
  }

  async chunkMatches(handle: FileHandle, chunk: IDepotChunk, buffer: Buffer): Promise<boolean> {
    this.checkBudget();
    const target = chunk.size <= buffer.length ? buffer : Buffer.alloc(chunk.size);
    const { bytesRead } = await handle.read(target, 0, chunk.size, chunk.offset);
    this.bytesRead += bytesRead;
    const digest = createHash("sha1").update(target.subarray(0, bytesRead)).digest("hex");
    return bytesRead === chunk.size && digest === chunk.sha1;
  }

  /** For files the manifest lists without chunks: hash the whole file in pieces. */
  async wholeFileMatches(handle: FileHandle, sha1: string, buffer: Buffer): Promise<boolean> {
    const hash = createHash("sha1");
    for (let position = 0; ; ) {
      this.checkBudget();
      // sequential: one buffer, and the hash needs the bytes in order
      // oxlint-disable-next-line no-await-in-loop
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      this.bytesRead += bytesRead;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest("hex") === sha1;
  }

  async compareChunks(
    handle: FileHandle,
    file: IDepotFile,
    buffer: Buffer,
  ): Promise<VerifyOutcome> {
    const { chunks } = file;
    const [first] = chunks;
    if (first === undefined) return { kind: "verified" };
    const sampled = sampledChunkIndices(chunks.length);
    // the first chunk is read first: an executable is hashed in full, since patches land anywhere
    const firstMatches = await this.chunkMatches(handle, first, buffer);
    const isExecutable = first.offset === 0 && buffer[0] === 0x4d && buffer[1] === 0x5a;
    const order =
      this.#options.fullVerify || isExecutable
        ? chunks.map((_, index) => index)
        : [...sampled].toSorted((lhs, rhs) => lhs - rhs);

    const mismatched = firstMatches ? [] : [0];
    for (const index of order) {
      const chunk = chunks[index];
      if (index === 0 || chunk === undefined) continue;
      if (mismatched.length > 0 && !this.#options.fullVerify) break;
      // sequential: one buffer per file, stop at the first mismatch, budget checked between reads
      // oxlint-disable-next-line no-await-in-loop
      if (!(await this.chunkMatches(handle, chunk, buffer))) mismatched.push(index);
    }
    if (mismatched.length === 0) return { kind: "verified" };

    const inSample = mismatched.some((index) => sampled.has(index));
    return {
      kind: "modified",
      by: inSample ? "sampled_chunk" : "full_hash",
      diskSize: file.size,
      chunkSampleWouldMiss: !inSample && !isExecutable,
      fileSampleWouldMiss: false,
    };
  }

  async hashFile(sized: ISized, buffer: Buffer): Promise<VerifyOutcome> {
    const { file } = sized;
    let handle: FileHandle | undefined;
    try {
      this.checkBudget();
      handle = await open(sized.path, "r");
      if (file.chunks.length > 0) return await this.compareChunks(handle, file, buffer);
      if (file.sha1 === "" || file.size === 0) return { kind: "verified" };
      return (await this.wholeFileMatches(handle, file.sha1, buffer))
        ? { kind: "verified" }
        : {
            kind: "modified",
            by: "full_hash",
            diskSize: file.size,
            chunkSampleWouldMiss: false,
            fileSampleWouldMiss: false,
          };
    } catch (err) {
      if (err instanceof LimitReached || this.#options.signal.aborted) throw err;
      return { kind: "unreadable" };
    } finally {
      await handle?.close();
    }
  }
}

/** Runs `task` over `items` on `concurrency` workers; stops them all at the first limit. */
async function runLimited<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, buffer: Buffer) => Promise<void>,
): Promise<LimitReached | undefined> {
  const queue = [...items];
  let limit: LimitReached | undefined;
  const worker = async (): Promise<void> => {
    const buffer = Buffer.alloc(CHUNK_BUFFER_SIZE);
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      try {
        // each worker takes one item at a time; `concurrency` workers run side by side
        // oxlint-disable-next-line no-await-in-loop
        await task(next, buffer);
      } catch (err) {
        if (!(err instanceof LimitReached)) throw err;
        limit ??= err;
        queue.length = 0;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return limit;
}

export async function verifySteamFiles(
  gamePath: string,
  baseline: IBaseline,
  options: IVerifyOptions,
): Promise<IVerification> {
  const verifier = new Verifier(options);
  const outcomes = new Map<string, VerifyOutcome>();
  const sized: ISized[] = [];

  let limit = await runLimited(
    [...baseline.files.entries()],
    SIZE_CHECK_CONCURRENCY,
    async ([key, file]) => {
      const outcome = await verifier.checkSize(gamePath, file);
      if (outcome.kind === "sized") sized.push({ key, file, path: outcome.path });
      else outcomes.set(key, outcome);
    },
  );

  const { chosen, capped } = chooseFilesToHash(
    sized.map((entry) => ({ ...entry, name: entry.file.name })),
    options.limits.hashSampleExecutables,
    options.limits.hashSampleFiles,
    options.random ?? Math.random,
  );
  const inSample = new Set(chosen.map((entry) => entry.key));
  if (!options.fullVerify) {
    for (const entry of sized) {
      if (!inSample.has(entry.key)) outcomes.set(entry.key, { kind: "size_matched" });
    }
  }

  if (limit === undefined) {
    limit = await runLimited(
      options.fullVerify
        ? [...chosen, ...sized.filter((entry) => !inSample.has(entry.key))]
        : chosen,
      options.limits.hashConcurrency,
      async (entry, buffer) => {
        const outcome = await verifier.hashFile(entry, buffer);
        outcomes.set(
          entry.key,
          outcome.kind === "modified"
            ? { ...outcome, fileSampleWouldMiss: !inSample.has(entry.key) }
            : outcome,
        );
      },
    );
  }

  for (const key of baseline.files.keys()) {
    if (!outcomes.has(key)) outcomes.set(key, { kind: "unchecked" });
  }
  return {
    status:
      limit === undefined
        ? { status: "checked", reason: null }
        : { status: "aborted", reason: limit.reason },
    outcomes,
    hashSample: { files: chosen.length, capped },
    bytesRead: verifier.bytesRead,
  };
}
