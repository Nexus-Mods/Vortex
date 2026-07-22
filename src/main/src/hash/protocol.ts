/**
 * Message protocol between the hash host (main thread) and the hash worker
 * (worker_thread). Jobs carry a file path and an algorithm name; the worker
 * streams the file itself, so only the path crosses the boundary, never the
 * file contents.
 */

export interface HashJob {
  id: number;
  // any algorithm name accepted by crypto.createHash / listed by crypto.getHashes()
  algorithm: string;
  filePath: string;
}

export interface HashResult {
  id: number;
  hash?: string;
  numBytes?: number;
  error?: string;
}
