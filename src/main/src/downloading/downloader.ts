import type { RateLimiter } from "limiter";
import type { IncomingHttpHeaders } from "node:http";

import got, { type Headers, type Delays as GotTimeoutOptions } from "got";
import { type FileHandle as NodeFileHandle, open } from "node:fs/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { ByteRange, Chunk, Chunker } from "./chunking";
import type { ChunkProgress, ProgressReporter } from "./progress";
import type { Resolver, NormalizedResource } from "./resolver";

import { isCancellation, toNetworkError, DownloadError } from "./errors";
import { normalize } from "./resolver";

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
  },
  options?: {
    progressReporter?: ProgressReporter;
    abortSignal?: AbortSignal;
    chunkConcurrency?: number;
    checkpoint?: Checkpoint;
    timeout?: TimeoutOptions;
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
    probe = await probeUrl(
      resolved.probeUrl,
      options?.checkpoint?.etag ?? null,
      {
        abortSignal: options?.abortSignal,
        timeout: options?.timeout,
      },
    );
  } catch (err) {
    if (isCancellation(err)) {
      throw new DownloadError(
        { code: "cancellation" },
        "Download cancelled",
        err,
      );
    }

    throw toNetworkError(resolved.probeUrl, err);
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
            downloadChunk(chunk, resolved, probe, handle, {
              abortSignal: options?.abortSignal,
              rateLimiter: strategy.rateLimiter,
              timeout: options?.timeout,
              progress: chunkProgress
                ? chunkProgress.get(chunk.index)
                : undefined,
            }),
        ),
      );
    } else {
      let writePosition = 0;
      let expectedRemainingBytes: number | undefined = undefined;
      let rangeChunk: Chunk | null = null;

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

        writePosition = currentEnd + 1;

        if (probe.size !== null) {
          expectedRemainingBytes = probe.size - writePosition;
        }
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

      const progress = options?.progressReporter?.init(probe.size);

      // Fast-forward progress to account for already-written bytes
      if (writePosition > 0 && progress) {
        progress.bytesReceived = writePosition;
        progress.bytesWritten = writePosition;
      }

      await downloadStream(resolved.probeUrl, handle, writePosition, {
        progress: progress,
        abortSignal: options?.abortSignal,
        rateLimiter: strategy.rateLimiter,
        timeout: options?.timeout,
        etag: probe.etag,
        chunk: rangeChunk,
        expectedRemainingBytes,
      });
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
  url: URL,
  previousETag: string | null,
  options: {
    abortSignal?: AbortSignal;
    timeout?: TimeoutOptions;
  },
): Promise<ProbeResult> {
  const response = await got.head(url, {
    signal: options?.abortSignal,
    headers: createHeaders(previousETag, null),
    timeout: createGotTimeoutOptions(options.timeout),
    retry: { limit: 0 },
  });

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
      { code: "protocol-violation", url: url },
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
  url: URL,
  options: {
    abortSignal?: AbortSignal;
    etag?: string;
    chunk?: Chunk;
    timeout?: TimeoutOptions;
  },
) {
  const stream = got.stream(url, {
    signal: options?.abortSignal,
    headers: createHeaders(options?.etag, options?.chunk),
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
  url: URL,
  handle: FileHandle,
  writePosition: number,
  options: {
    progress?: { bytesReceived: number; bytesWritten: number };
    abortSignal?: AbortSignal;
    rateLimiter?: RateLimiter;
    timeout?: TimeoutOptions;
    etag?: string;
    chunk?: Chunk;
    expectedRemainingBytes?: number;
  },
): Promise<void> {
  const { progress } = options;
  const stream = createGotStream(url, {
    abortSignal: options.abortSignal,
    etag: options.etag,
    chunk: options.chunk,
    timeout: options.timeout,
  });

  let remaining = options.expectedRemainingBytes;

  try {
    for await (const data of stream) {
      const buffer = data as Buffer;
      if (progress) progress.bytesReceived += buffer.length;

      if (remaining !== undefined) {
        if (buffer.length > remaining) {
          throw new DownloadError(
            { code: "protocol-violation", url: url },
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
    abortSignal?: AbortSignal;
  },
): Promise<void> {
  options.abortSignal?.throwIfAborted();

  const url = await resource.chunkUrl(chunk);
  const expectedRemainingBytes = chunk.range.end - chunk.range.start + 1;

  await downloadStream(url, handle, chunk.range.start, {
    chunk,
    expectedRemainingBytes,
    etag: probe.etag,
    progress: options.progress,
    rateLimiter: options.rateLimiter,
    timeout: options.timeout,
    abortSignal: options.abortSignal,
  });
}

function createHeaders(
  etag: string | undefined,
  chunk: Chunk | undefined,
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
