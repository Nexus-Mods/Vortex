/**
 * Pure file-hashing core, kept separate from worker.ts (a worker_thread entry
 * point with parentPort side effects) so it can be unit-tested directly.
 */

import { createHash, getHashes } from "node:crypto";
import * as fs from "node:fs";

const supportedAlgorithms = new Set(getHashes());

/** True if the algorithm name is one crypto.createHash accepts on this build. */
export function isSupportedAlgorithm(algorithm: string): boolean {
  return supportedAlgorithms.has(algorithm);
}

/**
 * Stream a file and compute its hex digest. Rejects on an unsupported algorithm
 * or any read error. numBytes is the number of bytes hashed (the file size).
 */
export function hashFileStream(
  algorithm: string,
  filePath: string,
): Promise<{ hash: string; numBytes: number }> {
  return new Promise((resolve, reject) => {
    if (!isSupportedAlgorithm(algorithm)) {
      reject(new Error(`unsupported hash algorithm: ${algorithm}`));
      return;
    }
    const hash = createHash(algorithm);
    let numBytes = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => {
      hash.update(chunk);
      numBytes += chunk.length;
    });
    stream.on("end", () => resolve({ hash: hash.digest("hex"), numBytes }));
    stream.on("error", reject);
  });
}
