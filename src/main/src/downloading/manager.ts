import { randomUUID } from "node:crypto";

import type {
  ByteRange,
  Chunker,
  DownloadCheckpoint,
  DownloadState,
  PauseResult,
  Resolver,
  RetryStrategy,
} from "@vortex/shared/download";
import { staticChunker } from "@vortex/shared/download";
import { DownloadError } from "@vortex/shared/errors";
import { RateLimiter } from "limiter";
import PQueue from "p-queue";
import type { CookieJar } from "tough-cookie";

import { log } from "../logging";
import type { TimeoutOptions } from "./downloader";
import { download } from "./downloader";
import { ProgressReporter } from "./progress";
import { defaultRetryStrategy } from "./retry";

export type DownloadHandle<T = unknown> = {
  /** Globally unique identifier for this download. */
  readonly downloadId: string;

  /** The promise resolves when the download completes. */
  readonly promise: Promise<void>;

  /** Returns a snapshot of the current download state. */
  getState: () => DownloadState;

  /**
   * Cancels the download if it is running. Returns the resulting state.
   * If the download is not running, returns the current state unchanged.
   */
  cancel: () => DownloadState;

  /**
   * Pauses the download if it is running. Returns the resulting state with
   * a checkpoint for later resumption. If the download is not running,
   * returns the current state unchanged.
   */
  pause: () => Promise<PauseResult<T>>;
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

export class DownloadManager {
  readonly #downloadQueue: PQueue;
  readonly #rateLimiter: RateLimiter | null;
  readonly #timeout: TimeoutOptions;
  readonly #userAgent: string | undefined;
  readonly #cookieJar: CookieJar | undefined;
  readonly #downloads: Map<string, DownloadHandle> = new Map();

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

  /**
   * Returns the handle for a tracked download, or `undefined` if the
   * `downloadId` has never been seen by this manager.
   */
  get(downloadId: string): DownloadHandle | undefined {
    return this.#downloads.get(downloadId);
  }

  /**
   * Returns a snapshot of the current state for a tracked download, or
   * `undefined` if the `downloadId` has never been seen by this manager.
   */
  getState(downloadId: string): DownloadState | undefined {
    return this.#downloads.get(downloadId)?.getState();
  }

  /**
   * Cancels a download if it is running. Returns the resulting state.
   * Throws if the `downloadId` is unknown.
   */
  cancel(downloadId: string): DownloadState {
    const handle = this.#downloads.get(downloadId);
    if (handle === undefined) throw new Error(`Unknown download: ${downloadId}`);
    return handle.cancel();
  }

  /**
   * Pauses a download if it is running. Returns the resulting state with a
   * checkpoint for later resumption. Throws if the `downloadId` is unknown.
   */
  pause(downloadId: string): Promise<PauseResult<unknown>> {
    const handle = this.#downloads.get(downloadId);
    if (handle === undefined) throw new Error(`Unknown download: ${downloadId}`);
    return handle.pause();
  }

  resume<T>(
    checkpoint: DownloadCheckpoint<T>,
    resolver: Resolver<T>,
    chunker: Chunker<T>,
    retry: RetryStrategy = defaultRetryStrategy(),
  ): DownloadHandle<T> {
    return this.#download(
      checkpoint.resource,
      checkpoint.dest,
      resolver,
      chunker,
      retry,
      checkpoint,
      checkpoint.downloadId,
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
    downloadId: string = randomUUID(),
  ): DownloadHandle<T> {
    const progressReporter = new ProgressReporter();
    const abortController = new AbortController();

    log("debug", "queuing download", { downloadId, dest });

    const rawPromise = this.#downloadQueue.add(() => {
      log("debug", "download starting", { downloadId });
      progressReporter.status = "running";
      return download(
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
      );
    });

    // Swallow all rejections on one fork so that pause()/cancel() flows
    // never surface as unhandled rejections.
    const settled = rawPromise.catch(() => {});

    // The consumer-facing promise. Cancellation rejections are swallowed so
    // that callers awaiting only pause() don't see unhandled rejections.
    // Non-cancellation errors still reject.
    const promise = rawPromise.catch((err) => {
      if (err instanceof DownloadError && err.code === "cancellation") return;
      throw err;
    });

    let terminalError: DownloadError | null = null;

    const cancel = (): DownloadState => {
      if (progressReporter.status === "running") {
        log("debug", "cancelling download", { downloadId });
        progressReporter.status = "canceled";
        abortController.abort();
      }
      return getState();
    };

    const buildCheckpoint = (): DownloadCheckpoint<T> => {
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
        completedRanges = [{ start: 0, end: progress.bytesWritten }];
      }

      return {
        downloadId,
        resource,
        dest,
        completedRanges,
        etag: progressReporter.etag,
      };
    };

    const pause = async (): Promise<PauseResult<T>> => {
      const currentStatus = progressReporter.status;

      if (currentStatus === "paused") {
        return {
          ...getState(),
          status: currentStatus,
          checkpoint: buildCheckpoint(),
        };
      }

      if (currentStatus !== "running") {
        return { ...getState(), status: currentStatus, error: terminalError };
      }

      log("debug", "pausing download", { downloadId });
      progressReporter.status = "paused";
      abortController.abort();
      // Wait for the download to fully settle (settled never rejects).
      await settled;
      log("debug", "download paused", { downloadId });

      return { ...getState(), status: "paused", checkpoint: buildCheckpoint() };
    };

    const getState = (): DownloadState => {
      const progress = progressReporter.getProgress();
      const currentStatus = progressReporter.status;

      if (currentStatus === "failed") {
        return { ...progress, status: currentStatus, error: terminalError };
      }

      return { ...progress, status: currentStatus };
    };

    const handle: DownloadHandle<T> = {
      downloadId,
      promise,
      getState,
      cancel,
      pause,
    };

    this.#downloads.set(downloadId, handle);

    // Handle terminal status transitions not covered by cancel() or pause().
    // Only updates status if it is still "running" - explicit control operations
    // (cancel/pause) set status synchronously before aborting, so they take
    // precedence.
    void rawPromise.then(
      () => {
        log("debug", "download completed", { downloadId });
        progressReporter.status = "completed";
      },
      (err) => {
        if (progressReporter.status !== "running") return;
        const isCancellation = err instanceof DownloadError && err.code === "cancellation";
        progressReporter.status = isCancellation ? "canceled" : "failed";
        if (err instanceof DownloadError) terminalError = err;
        if (!isCancellation) {
          log("warn", "download failed", { downloadId, err });
        }
      },
    );

    return handle;
  }
}
