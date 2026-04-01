import { access, readFile } from "node:fs/promises";
import path from "node:path/win32";

import { getVortexPath } from "../../getVortexPath";

const HEADER_SIZE = 0x28;
const TOC_HEADER_SIZE = 0x1c;
const HASH_ENTRY_SIZE = 0x38;
const HASH_MAP_CANDIDATES = [
  path.join(getVortexPath("assets"), "cp77-hash-map.json"),
  path.join(getVortexPath("assets"), "cp77-archive-helper", "hash-map.json"),
  path.join(getVortexPath("assets"), "cp77-archive-helper", "hashes.json"),
];

export interface IArchiveHashEntry {
  hash: string;
  mappedName?: string;
}

let hashMapPromise: Promise<Record<string, string>> | undefined;

export async function parseCyberpunkArchive(
  archivePath: string,
): Promise<IArchiveHashEntry[]> {
  const buf = await readFile(archivePath);
  if (buf.length < HEADER_SIZE) {
    throw new Error(`Archive is too small to be valid: ${archivePath}`);
  }

  const magic = buf.toString("ascii", 0, 4);
  if (magic !== "RDAR") {
    throw new Error(`Unsupported Cyberpunk archive signature "${magic}" in ${archivePath}`);
  }

  const version = buf.readUInt32LE(4);
  if (version !== 0x0c) {
    throw new Error(`Unsupported Cyberpunk archive version ${version} in ${archivePath}`);
  }

  const tocOffset = Number(buf.readBigUInt64LE(8));
  if (!Number.isFinite(tocOffset) || tocOffset < HEADER_SIZE || tocOffset >= buf.length) {
    throw new Error(`Archive TOC offset is invalid in ${archivePath}`);
  }

  if (tocOffset + TOC_HEADER_SIZE > buf.length) {
    throw new Error(`Archive TOC header is truncated in ${archivePath}`);
  }

  const hashEntryCount = buf.readUInt32LE(tocOffset + 0x10);
  const hashTableOffset = tocOffset + TOC_HEADER_SIZE;
  const hashTableSize = hashEntryCount * HASH_ENTRY_SIZE;
  if (hashTableOffset + hashTableSize > buf.length) {
    throw new Error(`Archive hash table is truncated in ${archivePath}`);
  }

  const nameMap = await loadHashNameMap();
  const results: IArchiveHashEntry[] = [];
  for (let idx = 0; idx < hashEntryCount; idx += 1) {
    const entryOffset = hashTableOffset + idx * HASH_ENTRY_SIZE;
    const hashValue = buf.readBigUInt64LE(entryOffset);
    const hash = hashValue.toString(16).padStart(16, "0");
    results.push({
      hash,
      mappedName: nameMap[hash],
    });
  }

  return results;
}

export function resetCyberpunkArchiveHashMapCache(): void {
  hashMapPromise = undefined;
}

async function loadHashNameMap(): Promise<Record<string, string>> {
  if (hashMapPromise == null) {
    hashMapPromise = loadHashNameMapImpl();
  }
  return hashMapPromise;
}

async function loadHashNameMapImpl(): Promise<Record<string, string>> {
  for (const candidate of HASH_MAP_CANDIDATES) {
    try {
      await access(candidate);
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return normalizeHashMap(parsed);
    } catch {
      continue;
    }
  }

  return {};
}

function normalizeHashMap(input: unknown): Record<string, string> {
  if (Array.isArray(input)) {
    return input.reduce((accum, entry) => {
      if (entry != null && typeof entry === "object") {
        const hash = normalizeHashValue((entry as Record<string, unknown>).hash);
        const name = (entry as Record<string, unknown>).name;
        if (hash != null && typeof name === "string" && name.length > 0) {
          accum[hash] = name;
        }
      }
      return accum;
    }, {} as Record<string, string>);
  }

  if (input != null && typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).reduce(
      (accum, [hash, name]) => {
        const normalizedHash = normalizeHashValue(hash);
        if (normalizedHash != null && typeof name === "string" && name.length > 0) {
          accum[normalizedHash] = name;
        }
        return accum;
      },
      {} as Record<string, string>,
    );
  }

  return {};
}

function normalizeHashValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(normalized)) {
    return undefined;
  }
  return normalized.padStart(16, "0");
}
