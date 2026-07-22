/**
 * File-hash worker. Runs on a main-process worker_thread so streaming a large
 * file and computing its digest stays off both the renderer UI thread and the
 * main event loop. The host posts one job per message and every job is answered
 * with exactly one response carrying the same id, so a caller never hangs. The
 * worker reads the file itself (see compute.ts), so only the path crosses the
 * boundary, never the contents.
 */

import { parentPort } from "node:worker_threads";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { hashFileStream } from "./compute";
import type { HashJob, HashResult } from "./protocol";

if (parentPort === null) {
  throw new Error("hash worker must run as a worker_thread");
}
const port = parentPort;

async function handleJob(job: HashJob): Promise<void> {
  let result: HashResult;
  try {
    const { hash, numBytes } = await hashFileStream(job.algorithm, job.filePath);
    result = { id: job.id, hash, numBytes };
  } catch (err) {
    result = { id: job.id, error: getErrorMessageOrDefault(err) };
  }
  port.postMessage(result);
}

port.on("message", (job: HashJob) => {
  void handleJob(job);
});
