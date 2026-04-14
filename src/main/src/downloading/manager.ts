import type { CookieJar } from "tough-cookie";

import { DownloadError } from "@vortex/shared/errors";
import { RateLimiter } from "limiter";
import PQueue from "p-queue";

import type { Chunker, ByteRange } from "./chunking";
import type { TimeoutOptions } from "./downloader";
import type { DownloadProgress } from "./progress";
import type { Resolver } from "./resolver";
import type { RetryStrategy } from "./retry";

import { staticChunker } from "./chunking";
import { download } from "./downloader";
import { ProgressReporter } from "./progress";
import { defaultRetryStrategy } from "./retry";

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

export const defaultTimeout: () => TimeoutOptions = () => ({
  lookup: 5_000,
  connect: 30_000,
  stall: 15_000,
  request: 5 * 60_000,
});

export type DownloadManagerOptions = {
  /** Maximum number of concurrent downloads. */
  concurrency: number;

  /** Optional global bandwidth limit in bytes per second. */
  bytesPerSecond?: number;

  /** Optional timeout settings. */
  timeout?: Partial<TimeoutOptions>;

  /** Optional User-Agent header sent on every request. */
  userAgent?: string;

  /** Optional cookie jar for cookie management. */
  cookieJar?: CookieJar;
};

export type DownloadCheckpoint<T = unknown> = {
  resource: T;
  dest: string;
  completedRanges: ByteRange[];
  etag: string | null;
};

export class DownloadManager {
  readonly #downloadQueue: PQueue;
  readonly #rateLimiter: RateLimiter | null;
  readonly #timeout: TimeoutOptions;
  readonly #userAgent: string | undefined;
  readonly #cookieJar: CookieJar | undefined;

  constructor(options: DownloadManagerOptions) {
    this.#downloadQueue = new PQueue({
      concurrency: options.concurrency,
    });

    const { bytesPerSecond, timeout, userAgent, cookieJar } = options;
    this.#userAgent = userAgent;
    this.#cookieJar = cookieJar;

    if (bytesPerSecond && !isNaN(bytesPerSecond)) {
      this.#rateLimiter = new RateLimiter({
        tokensPerInterval: bytesPerSecond,
        interval: "second",
      });
    } else {
      this.#rateLimiter = null;
    }

    this.#timeout = { ...defaultTimeout(), ...timeout };
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
    retry: RetryStrategy = defaultRetryStrategy(),
  ): DownloadHandle {
    return this.#download(
      checkpoint.resource,
      checkpoint.dest,
      resolver,
      chunker,
      retry,
      checkpoint,
    );
  }

  download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T> = staticChunker(),
    retry: RetryStrategy = defaultRetryStrategy(),
  ): DownloadHandle<T> {
    return this.#download(resource, dest, resolver, chunker, retry);
  }

  #download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T>,
    retry: RetryStrategy,
    checkpoint?: DownloadCheckpoint<T>,
  ): DownloadHandle<T> {
    const progressReporter = new ProgressReporter();
    const abortController = new AbortController();

    const rawPromise = this.#downloadQueue.add(() =>
      download(
        resource,
        dest,
        {
          chunker,
          rateLimiter: this.#rateLimiter,
          resolver,
          retry: retry,
        },
        {
          abortSignal: abortController.signal,
          checkpoint,
          cookieJar: this.#cookieJar,
          progressReporter,
          timeout: this.#timeout,
          userAgent: this.#userAgent,
        },
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
