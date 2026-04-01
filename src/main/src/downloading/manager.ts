import PQueue from "p-queue";

import type { Chunker, ByteRange } from "./chunking";
import type { DownloadProgress } from "./progress";
import type { Resolver } from "./resolver";

import { staticChunker } from "./chunking";
import { download } from "./downloader";
import { DownloadError } from "./errors";
import { ProgressReporter } from "./progress";

export type DownloadHandle<T = unknown> = {
  /** The promise resolves when the download completes */
  readonly promise: Promise<void>;

  /** Returns the current download progress. */
  getProgress: () => DownloadProgress;

  /** Cancels the download. */
  cancel: () => void;

  /** Pauses the download. */
  pause: () => Promise<DownloadCheckpoint<T>>;
};

export type DownloadCheckpoint<T = unknown> = {
  resource: T;
  dest: string;
  completedRanges: ByteRange[];
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
  ): DownloadHandle<T> {
    const progressReporter = new ProgressReporter();
    const abortController = new AbortController();

    const promise = this.#downloadQueue.add(() =>
      download(
        resource,
        dest,
        resolver,
        chunker,
        progressReporter,
        abortController.signal,
      ),
    );

    const pause = async (): Promise<DownloadCheckpoint<T>> => {
      abortController.abort();
      await promise.catch((err) => {
        if (err instanceof DownloadError && err.code === "cancellation") return;
        throw err;
      });

      const progress = progressReporter.getProgress();
      let completedRanges: ByteRange[] = [];

      if (progress.isChunked) {
        completedRanges = progress.chunks.map((c) => c.chunkRange);
      } else if (progress.bytesWritten > 0) {
        completedRanges = [
          {
            start: 0,
            end: progress.bytesWritten,
          },
        ];
      }

      return {
        resource,
        dest,
        completedRanges,
      };
    };

    return {
      promise,
      getProgress: () => progressReporter.getProgress(),
      cancel: () => abortController.abort(),
      pause,
    };
  }
}
