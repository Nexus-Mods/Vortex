import type { IncomingHttpHeaders } from "node:http";

import got, { type Headers } from "got";
import { type WriteStream } from "node:fs";
import { type FileHandle as NodeFileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { ByteRange, Chunk, Chunker } from "./chunking";
import type { ChunkProgress, Progress, ProgressReporter } from "./progress";
import type { Resolver, NormalizedResource } from "./resolver";

import { isCancellation, toNetworkError, DownloadError } from "./errors";
import { normalize } from "./resolver";

export const defaultChunkConcurrency = 4;

/** @internal */
export type Checkpoint = {
  etag: string | null;
  completedRanges: ByteRange[];
};

/** @internal */
export async function download<T>(
  resource: T,
  dest: string,
  resolver: Resolver<T>,
  chunker: Chunker<T>,
  progressReporter: ProgressReporter,
  abortSignal: AbortSignal,
  chunkConcurrency: number = defaultChunkConcurrency,
  checkpoint: Checkpoint | null = null,
): Promise<void> {
  if (abortSignal.aborted) {
    throw new DownloadError({ code: "cancellation" }, "Download cancelled");
  }

  let resolved: NormalizedResource;
  try {
    resolved = normalize(await resolver(resource));
  } catch (err) {
    throw new DownloadError({ code: "resolver-error" }, "Resolver failed", err);
  }

  let probe: ProbeResult;
  try {
    probe = await probeUrl(
      resolved.probeUrl,
      abortSignal,
      checkpoint?.etag ?? null,
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

  if (probe.etag) progressReporter.etag = probe.etag;

  const canChunk = probe.acceptsRanges && probe.size > 0;
  const chunks = canChunk
    ? await Promise.resolve(chunker(probe.size, resource))
    : [];

  const isChunked = chunks.length > 0;

  const completedRanges = checkpoint?.completedRanges ?? [];
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
    const flag = checkpoint === null ? "w+" : "r+";
    const fd = await open(dest, flag);
    handle = { fd, path: dest };
  } catch (err) {
    throw new DownloadError(
      { code: "fs-error", path: dest },
      `Failed to open ${dest}`,
      err,
    );
  }

  if (checkpoint === null && probe.size > 0) {
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
      const chunkQueue = new PQueue({ concurrency: chunkConcurrency });
      const chunkProgress = progressReporter.initChunked(chunks, probe.size);

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

      await downloadChunked(
        resolved,
        probe,
        handle,
        chunkQueue,
        pendingChunks,
        chunkProgress,
        abortSignal,
      );
    } else {
      const progress = progressReporter.init(probe.size);

      await downloadSingle(resolved, probe, handle, progress, abortSignal);
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
  abortSignal: AbortSignal,
  previousETag: string | null,
): Promise<ProbeResult> {
  const response = await got.head(url, {
    signal: abortSignal,
    headers: createHeaders(previousETag, null),
  });

  const size = getSize(response.headers, "content-length");

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Ranges
  // NOTE(erri120): only valid range units are "bytes" and "none"
  // https://www.iana.org/assignments/http-parameters/http-parameters.xhtml#range-units
  const acceptsRanges = response.headers["accept-ranges"] === "bytes";

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
  const etag = response.headers.etag ?? null;

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
  abortSignal: AbortSignal,
  etag: string | null,
  chunk: Chunk | null,
) {
  const stream = got.stream(url, {
    signal: abortSignal,
    headers: createHeaders(etag, chunk),
  });

  // Prevent uncaught-exception when abort destroys the stream before
  // pipeline or for-await-of attaches its own error handler.
  stream.on("error", () => {});

  return stream;
}

async function downloadSingle(
  resource: NormalizedResource,
  probe: ProbeResult,
  handle: FileHandle,
  progress: Progress,
  abortSignal: AbortSignal,
): Promise<void> {
  const stream = createGotStream(
    resource.probeUrl,
    abortSignal,
    probe.etag,
    null,
  );

  let fileStream: WriteStream;

  try {
    fileStream = handle.fd.createWriteStream({ autoClose: false });
  } catch (err) {
    throw new DownloadError(
      { code: "fs-error", path: handle.path },
      `Failed to create write stream for ${handle.path}`,
      err,
    );
  }

  try {
    stream.on("data", (data: Buffer) => {
      progress.bytesReceived += data.length;
    });

    await pipeline(stream, fileStream);
  } catch (err) {
    // NOTE(erri120): cancellation errors are handled by consumers
    if (isCancellation(err)) throw err;
    throw toNetworkError(stream.requestUrl, err);
  } finally {
    progress.bytesReceived = fileStream.bytesWritten;
    progress.bytesWritten = fileStream.bytesWritten;
    fileStream.destroy();
  }
}

async function downloadChunked(
  resource: NormalizedResource,
  probe: ProbeResult,
  handle: FileHandle,
  chunkQueue: PQueue,
  chunks: Chunk[],
  chunkProgress: Map<number, ChunkProgress>,
  abortSignal: AbortSignal,
): Promise<void> {
  await chunkQueue.addAll(
    chunks.map(
      (chunk) => async () =>
        downloadChunk(
          chunk,
          resource,
          probe,
          handle,
          chunkProgress.get(chunk.index),
          abortSignal,
        ),
    ),
  );
}

async function downloadChunk(
  chunk: Chunk,
  resource: NormalizedResource,
  probe: ProbeResult,
  handle: FileHandle,
  progress: ChunkProgress,
  abortSignal: AbortSignal,
): Promise<void> {
  abortSignal.throwIfAborted();

  const url = await resource.chunkUrl(chunk);
  const stream = createGotStream(url, abortSignal, probe.etag, chunk);

  let writePosition = chunk.range.start;

  try {
    for await (const data of stream) {
      const buffer = data as Buffer;
      progress.bytesReceived += buffer.length;

      const remaining = chunk.range.end - writePosition + 1;
      if (buffer.length > remaining) {
        throw new DownloadError(
          { code: "protocol-violation", url: url },
          `Server sent ${buffer.length} bytes but only ${remaining} were expected for chunk ${chunk.index} (bytes ${chunk.range.start}-${chunk.range.end}); response exceeds requested range`,
        );
      }

      let bytesWritten = 0;

      try {
        const result = await handle.fd.write(
          buffer,
          0,
          buffer.length,
          writePosition,
        );

        bytesWritten += result.bytesWritten;
        writePosition += result.bytesWritten;
      } catch (err) {
        throw new DownloadError(
          { code: "fs-error", path: handle.path },
          `Failed to write to ${handle.path}`,
          err,
        );
      } finally {
        progress.bytesWritten += bytesWritten;
      }
    }
  } catch (err) {
    if (err instanceof DownloadError || isCancellation(err)) throw err;
    throw toNetworkError(stream.requestUrl, err);
  }
}

function createHeaders(etag: string | null, chunk: Chunk | null): Headers {
  const range = chunk
    ? `bytes=${chunk.range.start}-${chunk.range.end}`
    : undefined;

  // Weak ETags MUST NOT be used with preconditions. The "W/" prefix is case sensitive.
  // https://www.rfc-editor.org/rfc/rfc9110#name-etag
  const isStrongETag = etag !== null && !etag.startsWith("W/");
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
