/**
 * Message protocol between the bsdiff host (main thread) and the patch worker
 * (worker_thread). Jobs carry only file paths; the worker does its own I/O.
 */

export interface BsdiffJob {
  id: number;
  // "create" diffs oldPath against secondPath (the new file) into outPath (the patch).
  // "apply" patches oldPath with secondPath (the patch) into outPath (the result).
  op: "create" | "apply";
  oldPath: string;
  secondPath: string;
  outPath: string;
}

export interface BsdiffResult {
  id: number;
  error?: string;
}
