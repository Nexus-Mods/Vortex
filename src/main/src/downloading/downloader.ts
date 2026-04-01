import got, { type Headers } from "got";
import { type WriteStream } from "node:fs";
import { type FileHandle as NodeFileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { Chunk, Chunker } from "./chunking";
import type { ChunkProgress, ProgressReporter } from "./progress";
import type { Resolver, NormalizedResource } from "./resolver";

import { isCancellation, toNetworkError, DownloadError } from "./errors";
import { normalize } from "./resolver";

/** @internal */
export async function download<T>(
  resource: T,
  dest: string,
  resolver: Resolver<T>,
  chunker: Chunker<T>,
  progressReporter: ProgressReporter,
  abortSignal: AbortSignal,
  chunkConcurrency: number = 4,
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
    probe = await probeUrl(resolved.probeUrl, abortSignal);
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

  const chunks = probe.acceptsRanges
    ? await Promise.resolve(chunker(probe.size, resource))
    : [];

  progressReporter.init(chunks, probe.size > 0 ? probe.size : null);

  let handle: FileHandle;

  try {
    const fd = await open(dest, "w");
    handle = { fd, path: dest };
  } catch (err) {
    throw new DownloadError(
      { code: "fs-error", path: dest },
      `Failed to open ${dest}`,
      err,
    );
  }

  try {
    if (chunks.length === 0) {
      await downloadSingle(
        resolved,
        probe,
        handle,
        progressReporter.chunkProgress[0],
        abortSignal,
      );
    } else {
      const chunkQueue = new PQueue({ concurrency: chunkConcurrency });

      await downloadChunked(
        resolved,
        probe,
        handle,
        chunkQueue,
        chunks,
        progressReporter.chunkProgress,
        abortSignal,
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
  url: URL,
  abortSignal: AbortSignal,
): Promise<ProbeResult> {
  const response = await got.head(url, {
    signal: abortSignal,
  });

  const contentLength = response.headers["content-length"];
  let size = contentLength ? parseInt(contentLength, 10) : 0;
  size = isNaN(size) ? 0 : size;

  const acceptsRanges = response.headers["accept-ranges"] === "bytes";
  const etag = response.headers.etag ?? null;

  return { size, acceptsRanges, etag };
}

async function downloadSingle(
  resource: NormalizedResource,
  probe: ProbeResult,
  handle: FileHandle,
  progress: ChunkProgress,
  abortSignal: AbortSignal,
): Promise<void> {
  const stream = got.stream(resource.probeUrl, {
    signal: abortSignal,
    headers: createHeaders(probe.etag, null),
  });

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
  chunkProgress: ChunkProgress[],
  abortSignal: AbortSignal,
): Promise<void> {
  try {
    await handle.fd.truncate(probe.size);
  } catch (err) {
    throw new DownloadError(
      { code: "fs-error", path: handle.path },
      `Failed to truncate ${handle.path}`,
      err,
    );
  }

  await chunkQueue.addAll(
    chunks.map(
      (chunk) => async () =>
        downloadChunk(
          chunk,
          resource,
          probe,
          handle,
          chunkProgress[chunk.index],
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
  const stream = got.stream(url, {
    signal: abortSignal,
    headers: createHeaders(probe.etag, chunk),
  });

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

type ProbeResult = {
  size: number;
  acceptsRanges: boolean;
  etag: string | null;
};

type FileHandle = { fd: NodeFileHandle; path: string };
