import PQueue from "p-queue";

import type { Chunker } from "./chunking";
import type { DownloadProgress } from "./progress";
import type { Resolver } from "./resolver";

import { staticChunker } from "./chunking";
import { download } from "./downloader";
import { ProgressReporter } from "./progress";

export type DownloadHandle = {
  /** The promise resolves when the download completes */
  readonly promise: Promise<void>;

  /** Returns the current download progress. */
  getProgress: () => DownloadProgress;
};

export class DownloadManager {
  readonly #downloadQueue: PQueue;

  constructor(initialConcurrency: number) {
    this.#downloadQueue = new PQueue({
      concurrency: initialConcurrency,
    });
  }

  /** Number of pending downloads. */
  get numPending(): number {
    return this.#downloadQueue.pending;
  }

  /** Number of running downloads. */
  get numRunning(): number {
    return this.#downloadQueue.runningTasks.length;
  }

  download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T> = staticChunker(),
  ): DownloadHandle {
    const progressReporter = new ProgressReporter();

    const promise = this.#downloadQueue.add(() =>
      download(resource, dest, resolver, chunker, progressReporter),
    );

    return {
      promise,
      getProgress: () => progressReporter.getProgress(),
    };
  }
}
