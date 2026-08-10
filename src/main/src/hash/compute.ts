/**
 * Pure file-hashing core, kept separate from worker.ts (a worker_thread entry
 * point with parentPort side effects) so it can be unit-tested directly.
 */

import { createHash, getHashes } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const supportedAlgorithms = new Set(getHashes());

/** True if the algorithm name is one crypto.createHash accepts on this build. */
export function isSupportedAlgorithm(algorithm: string): boolean {
  return supportedAlgorithms.has(algorithm);
}

/**
 * Stream a file and compute its hex digest. Rejects on an unsupported algorithm
 * or any read error. numBytes is the number of bytes hashed (the file size).
 */
export async function hashFileStream(
  algorithm: string,
  filePath: string,
): Promise<{ hash: string; numBytes: number }> {
  if (!isSupportedAlgorithm(algorithm)) {
    throw new Error(`unsupported hash algorithm: ${algorithm}`);
  }
  const hash = createHash(algorithm);
  const source = createReadStream(filePath);
  await pipeline(source, hash);
  return { hash: hash.digest("hex"), numBytes: source.bytesRead };
}
