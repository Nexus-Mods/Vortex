/**
 * Owns a small pool of hash worker_threads for the main process and exposes a
 * promise-returning file-hash operation. Workers are spawned lazily on the first
 * job; each worker processes one job at a time and jobs beyond the pool size
 * queue until a worker frees up. This keeps concurrent download finalizations
 * from serializing on a single thread. A crashed worker rejects only the job it
 * was running and is replaced on the next dispatch.
 *
 * The pool is a class parameterized by a worker factory so the scheduling logic
 * can be unit-tested with a fake worker; the process shares one default instance
 * exposed via hashFile / shutdownHashWorker.
 */

import * as os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";

import { getErrorMessageOrDefault, VortexError } from "@vortex/shared";

import type { HashJob, HashResult } from "./protocol";

const WORKER_SCRIPT = path.join(__dirname, "hash-worker.cjs");

// Hashing is largely disk-bound, so a small pool is enough to stop concurrent
// finalizations serializing without thrashing the disk with too many readers.
const POOL_SIZE = Math.max(2, Math.min(4, os.cpus().length - 1));

export interface HashFileResult {
  hash: string;
  numBytes: number;
}

/**
 * The subset of worker_threads.Worker the pool depends on. Kept minimal so a
 * fake worker can stand in during tests.
 */
export interface HashWorker {
  postMessage(message: HashJob): void;
  on(event: "message", listener: (result: HashResult) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  on(event: "exit", listener: (code: number) => void): void;
  terminate(): Promise<unknown>;
  unref(): void;
}

interface Job {
  id: number;
  algorithm: string;
  filePath: string;
  resolve: (result: HashFileResult) => void;
  reject: (err: Error) => void;
}

interface PoolWorker {
  worker: HashWorker;
  job: Job | undefined;
}

function defaultCreateWorker(): HashWorker {
  return new Worker(WORKER_SCRIPT);
}

// Surface pool failures as VortexError so the reworked error system classifies
// them by data.kind; prototype identity is lost across the worker/IPC boundaries.
function hashWorkerError(message: string, cause?: unknown): VortexError {
  return new VortexError(message, { kind: "setup-error", component: "hash-worker" }, { cause });
}

export class HashWorkerPool {
  readonly #createWorker: () => HashWorker;
  readonly #size: number;
  readonly #pool: PoolWorker[] = [];
  readonly #queue: Job[] = [];
  #nextId = 0;
  #shuttingDown = false;

  constructor(createWorker: () => HashWorker = defaultCreateWorker, size: number = POOL_SIZE) {
    this.#createWorker = createWorker;
    this.#size = Math.max(1, size);
  }

  /**
   * Compute the hex digest of a file off-thread. algorithm is any name accepted
   * by crypto.createHash / listed by crypto.getHashes(). Concurrent calls run in
   * parallel up to the pool size; the rest queue.
   */
  hashFile(algorithm: string, filePath: string): Promise<HashFileResult> {
    return new Promise<HashFileResult>((resolve, reject) => {
      const job: Job = { id: this.#nextId++, algorithm, filePath, resolve, reject };
      this.#queue.push(job);
      try {
        this.#ensurePool();
      } catch (err) {
        // Spawning a worker failed (e.g. the bundled worker script is missing).
        // Drop the job we just queued so a later spawn can't run it for an
        // already-rejected promise, then surface the failure.
        const idx = this.#queue.indexOf(job);
        if (idx !== -1) {
          this.#queue.splice(idx, 1);
        }
        reject(hashWorkerError(getErrorMessageOrDefault(err), err));
        return;
      }
      this.#drain();
    });
  }

  /** Terminate all workers. Call during app shutdown. */
  async shutdown(): Promise<void> {
    this.#shuttingDown = true;
    const workers = this.#pool.splice(0, this.#pool.length);
    await Promise.all(workers.map((pw) => pw.worker.terminate()));
  }

  // Assign the next queued job to a now-idle worker, or leave it idle.
  #assignNext(pw: PoolWorker): void {
    const next = this.#queue.shift();
    pw.job = next;
    if (next !== undefined) {
      pw.worker.postMessage({
        id: next.id,
        algorithm: next.algorithm,
        filePath: next.filePath,
      } satisfies HashJob);
    }
  }

  #handleFailure(pw: PoolWorker, err: Error): void {
    const idx = this.#pool.indexOf(pw);
    if (idx !== -1) {
      this.#pool.splice(idx, 1);
    }
    const job = pw.job;
    pw.job = undefined;
    if (job !== undefined) {
      job.reject(err);
    }
    if (this.#shuttingDown) {
      return;
    }
    this.#ensurePool();
    this.#drain();
  }

  #spawnWorker(): void {
    const worker = this.#createWorker();
    const pw: PoolWorker = { worker, job: undefined };
    worker.on("message", (result: HashResult) => {
      const job = pw.job;
      if (job !== undefined && job.id === result.id) {
        if (result.error !== undefined) {
          job.reject(hashWorkerError(result.error));
        } else {
          job.resolve({ hash: result.hash ?? "", numBytes: result.numBytes ?? 0 });
        }
      }
      // A worker answers each job with exactly one message, so any message means
      // it is now idle. Hand it the next job even if the id was unexpected, so a
      // stray message can never permanently park this pool slot.
      this.#assignNext(pw);
    });
    worker.on("error", (err: Error) => this.#handleFailure(pw, hashWorkerError(err.message, err)));
    worker.on("exit", (code: number) => {
      if (code !== 0) {
        this.#handleFailure(
          pw,
          hashWorkerError(`hash worker stopped unexpectedly (exit code ${code})`),
        );
      }
    });
    // Don't let idle workers keep the main process alive at shutdown; any
    // in-flight job at quit time is abandoned, which is acceptable.
    worker.unref();
    this.#pool.push(pw);
  }

  #ensurePool(): void {
    for (let i = this.#pool.length; i < this.#size; i += 1) {
      this.#spawnWorker();
    }
  }

  // Hand queued jobs to any idle workers.
  #drain(): void {
    for (const pw of this.#pool) {
      if (this.#queue.length === 0) {
        break;
      }
      if (pw.job === undefined) {
        this.#assignNext(pw);
      }
    }
  }
}

const defaultPool = new HashWorkerPool();

/**
 * Compute the hex digest of a file off-thread on the shared pool. algorithm is
 * any name accepted by crypto.createHash / listed by crypto.getHashes().
 */
export function hashFile(algorithm: string, filePath: string): Promise<HashFileResult> {
  return defaultPool.hashFile(algorithm, filePath);
}

/** Terminate the shared pool's workers. Call during app shutdown. */
export async function shutdownHashWorker(): Promise<void> {
  await defaultPool.shutdown();
}
