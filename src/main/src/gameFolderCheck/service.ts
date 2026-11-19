/**
 * Runs game folder checks one at a time, at most one per game; a check can be cancelled while
 * queued or running.
 */
import type { VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput } from "@vortex/shared/ipc";

import { runGameFolderCheck, type IRunOutput } from "./run";

interface IJob {
  input: GameFolderCheckInput;
  controller: AbortController;
  promise: Promise<IRunOutput | undefined>;
  resolve: (output: IRunOutput | undefined) => void;
  reject: (err: unknown) => void;
}

export type RunCheck = (input: GameFolderCheckInput, signal: AbortSignal) => Promise<IRunOutput>;

export class GameFolderCheckService {
  readonly #run: RunCheck;
  #queue: IJob[] = [];
  #running: IJob | undefined;

  constructor(run: RunCheck = runGameFolderCheck) {
    this.#run = run;
  }

  /**
   * Resolves with the finished check, or undefined if it was cancelled. A game that already has
   * a check queued or running joins it, e.g. a reloaded renderer starting its pending check again.
   */
  schedule(input: GameFolderCheckInput): Promise<IRunOutput | undefined> {
    const existing = [this.#running, ...this.#queue].find(
      (job) => job?.input.gameId === input.gameId,
    );
    if (existing !== undefined) return existing.promise;

    let settle: Pick<IJob, "resolve" | "reject"> | undefined;
    const promise = new Promise<IRunOutput | undefined>((resolve, reject) => {
      settle = { resolve, reject };
    });
    this.#queue.push({ input, controller: new AbortController(), promise, ...settle! });
    void this.#next();
    return promise;
  }

  cancel(gameId: VortexGameId): void {
    for (const job of this.#queue.filter((iter) => iter.input.gameId === gameId)) {
      job.resolve(undefined);
    }
    this.#queue = this.#queue.filter((iter) => iter.input.gameId !== gameId);
    if (this.#running?.input.gameId === gameId) {
      this.#running.controller.abort();
    }
  }

  async #next(): Promise<void> {
    if (this.#running !== undefined) return;
    const job = this.#queue.shift();
    if (job === undefined) return;

    this.#running = job;
    try {
      const output = await this.#run(job.input, job.controller.signal);
      // a cancel that lands after the last read still wins
      job.resolve(job.controller.signal.aborted ? undefined : output);
    } catch (err) {
      if (job.controller.signal.aborted) {
        job.resolve(undefined);
      } else {
        job.reject(err);
      }
    } finally {
      this.#running = undefined;
      void this.#next();
    }
  }
}
