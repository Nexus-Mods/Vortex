import PQueue from "p-queue";

import type { Chunker, ByteRange } from "./chunking";
import type { DownloadProgress } from "./progress";
import type { Resolver } from "./resolver";

import { staticChunker } from "./chunking";
import { defaultChunkConcurrency, download } from "./downloader";
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
  etag: string | null;
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

  resume<T>(
    checkpoint: DownloadCheckpoint<T>,
    resolver: Resolver<T>,
    chunker: Chunker<T>,
  ): DownloadHandle {
    return this.#download(
      checkpoint.resource,
      checkpoint.dest,
      resolver,
      chunker,
      checkpoint,
    );
  }

  download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T> = staticChunker(),
  ): DownloadHandle<T> {
    return this.#download(resource, dest, resolver, chunker, null);
  }

  #download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T>,
    checkpoint: DownloadCheckpoint<T> | null,
  ): DownloadHandle<T> {
    const progressReporter = new ProgressReporter();
    const abortController = new AbortController();

    const rawPromise = this.#downloadQueue.add(() =>
      download(
        resource,
        dest,
        resolver,
        chunker,
        progressReporter,
        abortController.signal,
        defaultChunkConcurrency,
        checkpoint,
      ),
    );

    // Swallow all rejections on one fork so that pause()/cancel() flows
    // never surface as unhandled rejections.
    const settled = rawPromise.catch(() => {});

    // The consumer-facing promise. We silently swallow cancellation
    // rejections so that tests (and callers) that only await pause()
    // without also awaiting handle.promise don't trigger unhandled
    // rejection warnings.  Non-cancellation errors still reject.
    const promise = rawPromise.catch((err) => {
      if (err instanceof DownloadError && err.code === "cancellation") return;
      throw err;
    });

    const pause = async (): Promise<DownloadCheckpoint<T>> => {
      abortController.abort();
      // Wait for the download to fully settle (settled never rejects).
      await settled;

      const progress = progressReporter.getProgress();
      let completedRanges: ByteRange[] = [];

      if (progress.isChunked) {
        completedRanges = progress.chunks
          .filter((c) => {
            const size = c.chunkRange.end - c.chunkRange.start + 1;
            return c.bytesWritten >= size;
          })
          .map((c) => c.chunkRange);
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
        etag: progressReporter.etag,
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
