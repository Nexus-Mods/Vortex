import type { RateLimiter } from "limiter";
import type { IncomingHttpHeaders } from "node:http";

import { unknownToError } from "@vortex/shared";
import { DownloadError } from "@vortex/shared/errors";
import got, { type Headers, type Delays as GotTimeoutOptions } from "got";
import { type FileHandle as NodeFileHandle, open } from "node:fs/promises";
import PQueue from "p-queue";

import type { ByteRange, Chunk, Chunker } from "./chunking";
import type { ChunkProgress, ProgressReporter } from "./progress";
import type {
  Resolver,
  NormalizedResource,
  ResolvedEndpoint,
} from "./resolver";
import type { RetryStrategy } from "./retry";

import { isCancellation, toNetworkError } from "./errors";
import { normalize } from "./resolver";
import { sleep } from "./retry";

export const defaultChunkConcurrency = 4;

/** @internal */
export type Checkpoint = {
  etag: string | null;
  completedRanges: ByteRange[];
};

export type TimeoutOptions = {
  // TODO: use Temporal API

  /** Hard upper limit for the entire duration of a single HTTP request (ms). */
  request: number;

  /** Timeout for DNS lookup (ms). */
  lookup: number;

  /** Timeout for DNS lookup + TCP connect + TLS handshake (ms). */
  connect: number;

  /** Timeout between received data packets before treating the connection as stalled (ms). */
  stall: number;
};

/** @internal */
export async function download<T>(
  resource: T,
  dest: string,
  strategy: {
    resolver: Resolver<T>;
    chunker: Chunker<T>;
    rateLimiter?: RateLimiter;
    retry?: RetryStrategy;
  },
  options?: {
    progressReporter?: ProgressReporter;
    abortSignal?: AbortSignal;
    chunkConcurrency?: number;
    checkpoint?: Checkpoint;
    timeout?: TimeoutOptions;
    userAgent?: string;
  },
): Promise<void> {
  if (options?.abortSignal?.aborted) {
    throw new DownloadError({ code: "cancellation" }, "Download cancelled");
  }

  let resolved: NormalizedResource;
  try {
    resolved = normalize(await strategy.resolver(resource));
  } catch (err) {
    throw new DownloadError({ code: "resolver-error" }, "Resolver failed", err);
  }

  let probe: ProbeResult;
  try {
    probe = await withRetry(
      () =>
        probeUrl(resolved.probeEndpoint, options?.checkpoint?.etag ?? null, {
          abortSignal: options?.abortSignal,
          timeout: options?.timeout,
          userAgent: options?.userAgent,
        }),
      strategy.retry,
      options?.abortSignal,
    );
  } catch (err) {
    if (isCancellation(err)) {
      throw new DownloadError(
        { code: "cancellation" },
        "Download cancelled",
        err,
      );
    }

    throw toNetworkError(resolved.probeEndpoint, err);
  }

  if (probe.etag && options?.progressReporter)
    options.progressReporter.etag = probe.etag;

  const canChunk = probe.acceptsRanges && probe.size > 0;
  const chunks = canChunk
    ? await Promise.resolve(strategy.chunker(probe.size, resource))
    : [];

  const isChunked = chunks.length > 1;

  const completedRanges = options?.checkpoint?.completedRanges ?? [];
  const pendingChunks = chunks.filter(
    (chunk) =>
      !completedRanges.some(
        (r) => r.start <= chunk.range.start && r.end >= chunk.range.end,
      ),
  );

  let handle: FileHandle;

  try {
    // https://nodejs.org/api/fs.html#file-system-flags
    // 'w+': Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
    // 'r+': Open file for reading and writing. An exception occurs if the file does not exist.
    const flag = options?.checkpoint ? "r+" : "w+";
    const fd = await open(dest, flag);
    handle = { fd, path: dest };
  } catch (err) {
    throw new DownloadError(
      { code: "fs-error", path: dest },
      `Failed to open ${dest}`,
      err,
    );
  }

  if (options?.checkpoint && probe.size > 0) {
    try {
      await handle.fd.truncate(probe.size);
    } catch (err) {
      throw new DownloadError(
        { code: "fs-error", path: handle.path },
        `Failed to truncate ${handle.path}`,
        err,
      );
    }
  }

  try {
    if (isChunked) {
      const chunkQueue = new PQueue({
        concurrency: options?.chunkConcurrency ?? defaultChunkConcurrency,
      });

      let chunkProgress: Map<number, ChunkProgress> | null = null;
      if (options?.progressReporter) {
        chunkProgress = options.progressReporter.initChunked(
          chunks,
          probe.size,
        );

        // fast forward progress reporter to checkpoint
        for (const chunk of chunks) {
          const isComplete = completedRanges.some(
            (r) => r.start <= chunk.range.start && r.end >= chunk.range.end,
          );
          if (isComplete) {
            const progress = chunkProgress.get(chunk.index);
            const size = chunk.range.end - chunk.range.start + 1;
            progress.bytesReceived = size;
            progress.bytesWritten = size;
          }
        }
      }

      await chunkQueue.addAll(
        pendingChunks.map(
          (chunk) => async () =>
            withRetry(
              () => {
                // Reset chunk progress before each attempt so a failed
                // partial download doesn't leave stale byte counts.
                if (chunkProgress) {
                  const progress = chunkProgress.get(chunk.index);
                  progress.bytesReceived = 0;
                  progress.bytesWritten = 0;
                }

                return downloadChunk(chunk, resolved, probe, handle, {
                  abortSignal: options?.abortSignal,
                  rateLimiter: strategy.rateLimiter,
                  timeout: options?.timeout,
                  userAgent: options?.userAgent,
                  progress: chunkProgress
                    ? chunkProgress.get(chunk.index)
                    : undefined,
                });
              },
              strategy.retry,
              options?.abortSignal,
            ),
        ),
      );
    } else {
      // Compute the checkpoint baseline: the contiguous byte position
      // that was already completed before this download call. On retry
      // we reset back to this position rather than to zero, because
      // those bytes are already valid on disk.
      let checkpointPosition = 0;

      if (options?.checkpoint && completedRanges.length > 0) {
        const sortedRanges = completedRanges.toSorted(
          (a, b) => a.start - b.start,
        );

        let currentEnd = -1;

        for (const range of sortedRanges) {
          if (range.start === currentEnd + 1) {
            currentEnd = range.end;
          } else if (range.start === 0) {
            currentEnd = range.end;
          } else {
            break;
          }
        }

        checkpointPosition = currentEnd + 1;
      }

      const progress = options?.progressReporter?.init(probe.size);

      await withRetry(
        () => {
          // Reset write position and progress back to the checkpoint
          // baseline on every attempt. Any bytes written by a previous
          // failed attempt will be overwritten.
          const writePosition = checkpointPosition;

          if (progress) {
            progress.bytesReceived = checkpointPosition;
            progress.bytesWritten = checkpointPosition;
          }

          let expectedRemainingBytes: number | undefined = undefined;
          let rangeChunk: Chunk | null = null;

          if (probe.size !== null && writePosition > 0) {
            expectedRemainingBytes = probe.size - writePosition;
          }

          // When the server supports range requests, use a Range header
          // even in the non-chunked path. This avoids re-downloading
          // already-completed bytes when resuming and lets the server
          // send only the remainder of the file.
          if (probe.acceptsRanges && probe.size > 0 && writePosition > 0) {
            rangeChunk = {
              index: 0,
              range: { start: writePosition, end: probe.size - 1 },
            };
            expectedRemainingBytes = probe.size - writePosition;
          }

          return downloadStream(resolved.probeEndpoint, handle, writePosition, {
            progress: progress,
            abortSignal: options?.abortSignal,
            rateLimiter: strategy.rateLimiter,
            timeout: options?.timeout,
            userAgent: options?.userAgent,
            etag: probe.etag,
            chunk: rangeChunk,
            expectedRemainingBytes,
          });
        },
        strategy.retry,
        options?.abortSignal,
      );
    }
  } catch (err) {
    if (isCancellation(err)) {
      throw new DownloadError(
        { code: "cancellation" },
        "Download cancelled",
        err,
      );
    }

    throw err;
  } finally {
    await handle.fd.close();
  }
}

async function probeUrl(
  endpoint: ResolvedEndpoint,
  previousETag: string | null,
  options: {
    abortSignal?: AbortSignal;
    timeout?: TimeoutOptions;
    userAgent?: string;
  },
): Promise<ProbeResult> {
  const response = await got.head(endpoint.url, {
    signal: options?.abortSignal,
    headers: createHeaders(
      previousETag,
      null,
      options.userAgent,
      endpoint.headers,
    ),
    timeout: createGotTimeoutOptions(options.timeout),
    retry: { limit: 0 },
  });

  const contentType = response.headers["content-type"] ?? "";
  if (contentType.startsWith("text/html")) {
    throw new DownloadError(
      { code: "is-html", url: endpoint.url },
      "Server returned an HTML page instead of a file",
    );
  }

  const size = getSize(response.headers, "content-length");

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Ranges
  // NOTE(erri120): only valid range units are "bytes" and "none"
  // https://www.iana.org/assignments/http-parameters/http-parameters.xhtml#range-units
  const acceptsRanges = response.headers["accept-ranges"] === "bytes";

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
  const etag = response.headers.etag ?? null;

  // NOTE(erri120): Server has to do the precondition check of the ETag.
  if (etag && previousETag && etag !== previousETag) {
    throw new DownloadError(
      { code: "protocol-violation", url: endpoint.url },
      "ETag has changed, server didn't validate precondition",
    );
  }

  return { size, acceptsRanges, etag };
}

/**
 * Create a got stream with an immediate no-op error listener.
 *
 * got internally calls `this.destroy(new AbortError())` inside an
 * `abort` event listener on the signal.  If the stream has no `error`
 * listener at that moment Node promotes the error to an uncaught
 * exception.  Attaching a no-op listener here prevents that;
 * downstream consumers still receive the error
 * through their own mechanisms.
 */
function createGotStream(
  endpoint: ResolvedEndpoint,
  options: {
    abortSignal?: AbortSignal;
    etag?: string;
    chunk?: Chunk;
    timeout?: TimeoutOptions;
    userAgent?: string;
  },
) {
  const stream = got.stream(endpoint.url, {
    signal: options?.abortSignal,
    headers: createHeaders(
      options?.etag,
      options?.chunk,
      options?.userAgent,
      endpoint.headers,
    ),
    timeout: createGotTimeoutOptions(options.timeout),
    retry: { limit: 0 },
  });

  stream.on("error", () => {});

  return stream;
}

function createGotTimeoutOptions(
  timeout?: TimeoutOptions,
): GotTimeoutOptions | undefined {
  if (!timeout) return undefined;

  return {
    lookup: timeout.lookup,
    connect: timeout.connect,
    secureConnect: timeout.connect,
    socket: timeout.stall,
    response: timeout.stall,
    request: timeout.request,
  };
}

async function consumeTokens(
  limiter: RateLimiter,
  bytes: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  let remaining = bytes;
  while (remaining > 0) {
    abortSignal?.throwIfAborted();
    const toRemove = Math.min(remaining, limiter.tokenBucket.bucketSize);
    const delay = limiter.removeTokens(toRemove);
    await delay;
    remaining -= toRemove;
  }
}

async function downloadStream(
  endpoint: ResolvedEndpoint,
  handle: FileHandle,
  writePosition: number,
  options: {
    progress?: { bytesReceived: number; bytesWritten: number };
    abortSignal?: AbortSignal;
    rateLimiter?: RateLimiter;
    timeout?: TimeoutOptions;
    userAgent?: string;
    etag?: string;
    chunk?: Chunk;
    expectedRemainingBytes?: number;
  },
): Promise<void> {
  const { progress } = options;
  const stream = createGotStream(endpoint, {
    abortSignal: options.abortSignal,
    etag: options.etag,
    chunk: options.chunk,
    timeout: options.timeout,
    userAgent: options.userAgent,
  });

  let remaining = options.expectedRemainingBytes;

  try {
    for await (const data of stream) {
      const buffer = data as Buffer;
      if (progress) progress.bytesReceived += buffer.length;

      if (remaining !== undefined) {
        if (buffer.length > remaining) {
          throw new DownloadError(
            { code: "protocol-violation", url: endpoint.url },
            `Server sent ${buffer.length} bytes but only ${remaining} were expected; response exceeds requested range`,
          );
        }
        remaining -= buffer.length;
      }

      if (options.rateLimiter) {
        await consumeTokens(
          options.rateLimiter,
          buffer.length,
          options.abortSignal,
        );
      }

      try {
        const result = await handle.fd.write(
          buffer,
          0,
          buffer.length,
          writePosition,
        );

        if (progress) progress.bytesWritten += result.bytesWritten;
        writePosition += result.bytesWritten;
      } catch (err) {
        throw new DownloadError(
          { code: "fs-error", path: handle.path },
          `Failed to write to ${handle.path}`,
          err,
        );
      }
    }
  } catch (err) {
    if (err instanceof DownloadError || isCancellation(err)) throw err;
    throw toNetworkError(stream.requestUrl, err);
  }
}

async function downloadChunk(
  chunk: Chunk,
  resource: NormalizedResource,
  probe: ProbeResult,
  handle: FileHandle,
  options: {
    progress?: ChunkProgress;
    rateLimiter?: RateLimiter;
    timeout?: TimeoutOptions;
    userAgent?: string;
    abortSignal?: AbortSignal;
  },
): Promise<void> {
  options.abortSignal?.throwIfAborted();

  const endpoint = await resource.chunkEndpoint(chunk);
  const expectedRemainingBytes = chunk.range.end - chunk.range.start + 1;

  await downloadStream(endpoint, handle, chunk.range.start, {
    chunk,
    expectedRemainingBytes,
    etag: probe.etag,
    progress: options.progress,
    rateLimiter: options.rateLimiter,
    timeout: options.timeout,
    userAgent: options.userAgent,
    abortSignal: options.abortSignal,
  });
}

/**
 * Retry helper that re-invokes `fn` according to the given strategy.
 * Cancellations are never retried. Uses abort-aware sleep so backoff
 * delays are interrupted when the signal fires.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  strategy?: RetryStrategy,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (!strategy) return await fn();

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isCancellation(err)) throw err;
      attempt++;
      const verdict = strategy({ attempt, error: unknownToError(err) });
      if (!verdict.retry) throw err;
      await sleep(verdict.delayMs, abortSignal);
    }
  }
}

function createHeaders(
  etag: string | undefined,
  chunk: Chunk | undefined,
  userAgent?: string,
  additionalHeaders?: Record<string, string>,
): Headers {
  const range = chunk
    ? `bytes=${chunk.range.start}-${chunk.range.end}`
    : undefined;

  // Weak ETags MUST NOT be used with preconditions. The "W/" prefix is case sensitive.
  // https://www.rfc-editor.org/rfc/rfc9110#name-etag
  const isStrongETag = etag && !etag.startsWith("W/");
  const ifMatch = isStrongETag ? etag : undefined;

  return {
    Range: range,
    "If-Match": ifMatch,
    "User-Agent": userAgent,
    ...(additionalHeaders ?? {}),
  };
}

function getSize(
  headers: IncomingHttpHeaders,
  header: "content-length" | "content-range",
): number | null {
  const rawValue = headers[header];
  if (!rawValue) return null;

  let parsed: number | null;
  if (header === "content-length") {
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Length
    // Content-Length: <length>
    parsed = parseInt(rawValue, 10);
  } else if (header === "content-range") {
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Range
    // Content-Range: <unit> <range>/<size>
    // Content-Range: <unit> <range>/*
    // Content-Range: <unit> */<size>
    const slashIndex = rawValue.lastIndexOf("/");
    if (slashIndex === -1) return null;

    const size = rawValue.slice(slashIndex + 1);
    if (size === "*") return null;

    parsed = parseInt(size, 10);
  }

  return isNaN(parsed) ? null : parsed;
}

type ProbeResult = {
  size: number | null;
  acceptsRanges: boolean;
  etag: string | null;
};

type FileHandle = { fd: NodeFileHandle; path: string };
