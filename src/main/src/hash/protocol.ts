/**
 * Message protocol between the hash host (main thread) and the hash worker
 * (worker_thread). Jobs carry a file path and an algorithm name; the worker
 * streams the file itself, so only the path crosses the boundary, never the
 * file contents.
 */

import type { HashAlgorithm } from "@vortex/shared/ipc";

export interface HashJob {
  id: number;
  algorithm: HashAlgorithm;
  filePath: string;
}

export interface HashResult {
  id: number;
  hash?: string;
  numBytes?: number;
  error?: string;
}
