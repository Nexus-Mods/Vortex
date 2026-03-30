import got, { type Headers } from "got";
import { type WriteStream } from "node:fs";
import { type FileHandle as NodeFileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { Chunk, Chunker } from "./chunking";
import type { DownloadProgress, ChunkProgress } from "./progress";
import type { Resolver, NormalizedResource } from "./resolver";

import { staticChunker } from "./chunking";
import { toNetworkError, DownloadError } from "./errors";
import { ProgressReporter } from "./progress";
import { normalize } from "./resolver";

export type DownloaderOptions = {
  /** Maximum simultaneous file downloads */
  downloadConcurrency: number;
  /** Maximum simultaneous chunk connections across all downloads */
  chunkConcurrency: number;
};

export type DownloadHandle = {
  /** The promise resolves when the download completes */
  readonly promise: Promise<void>;

  /** Returns the current download progress. */
  getProgress: () => DownloadProgress;
};

/** Creates instance of the options with default values */
export function defaultOptions(): DownloaderOptions {
  return {
    downloadConcurrency: 3,
    chunkConcurrency: 6,
  };
}

export class Downloader {
  readonly #downloadQueue: PQueue;
  readonly #chunkQueue: PQueue;
  readonly #options: DownloaderOptions;

  constructor(options: DownloaderOptions) {
    this.#options = options;

    this.#downloadQueue = new PQueue({
      concurrency: this.#options.downloadConcurrency,
    });

    this.#chunkQueue = new PQueue({
      concurrency: this.#options.chunkConcurrency,
    });
  }

  download<T>(
    resource: T,
    dest: string,
    resolver: Resolver<T>,
    chunker: Chunker<T> = staticChunker(),
  ): DownloadHandle {
    const progressReporter = new ProgressReporter();

    const promise = this.#downloadQueue.add(async (): Promise<void> => {
      let resolved: NormalizedResource;
      try {
        resolved = normalize(await resolver(resource));
      } catch (err) {
        throw new DownloadError(
          { code: "resolver-error" },
          "Resolver failed",
          err,
        );
      }

      let probe: ProbeResult;
      try {
        probe = await this.#probe(resolved.probeUrl);
      } catch (err) {
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
          await this.#downloadSingle(
            got.stream(resolved.probeUrl, {
              headers: createHeaders(probe.etag, null),
            }),
            handle,
            progressReporter.chunkProgress[0],
          );
        } else {
          try {
            await handle.fd.truncate(probe.size);
          } catch (err) {
            throw new DownloadError(
              { code: "fs-error", path: dest },
              `Failed to truncate ${dest}`,
              err,
            );
          }

          await this.#downloadChunked(
            resolved,
            handle,
            probe,
            chunks,
            progressReporter.chunkProgress,
          );
        }
      } finally {
        await handle.fd.close();
      }
    });

    return {
      promise,
      getProgress: () => progressReporter.getProgress(),
    };
  }

  async #probe(url: URL): Promise<ProbeResult> {
    const response = await got.head(url);

    const contentLength = response.headers["content-length"];
    let size = contentLength ? parseInt(contentLength, 10) : 0;
    size = isNaN(size) ? 0 : size;

    const acceptsRanges = response.headers["accept-ranges"] === "bytes";
    const etag = response.headers.etag ?? null;

    return { size, acceptsRanges, etag };
  }

  async #downloadSingle(
    stream: ReturnType<typeof got.stream>,
    handle: FileHandle,
    progress: ChunkProgress,
  ): Promise<void> {
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
      throw toNetworkError(stream.requestUrl, err);
    } finally {
      fileStream.destroy();
    }
  }

  async #downloadChunked(
    resource: NormalizedResource,
    handle: FileHandle,
    probe: ProbeResult,
    chunks: Chunk[],
    chunkProgress: ChunkProgress[],
  ): Promise<void> {
    await Promise.all(
      chunks.map((chunk) =>
        this.#chunkQueue.add(async () => {
          const url = await resource.chunkUrl(chunk);
          const stream = got.stream(url, {
            headers: createHeaders(probe.etag, chunk),
          });

          const result = await this.#downloadStream(
            stream,
            handle,
            chunkProgress[chunk.index],
            chunk.start,
          );

          return result;
        }),
      ),
    );
  }

  async #downloadStream(
    stream: ReturnType<typeof got.stream>,
    handle: FileHandle,
    progress: ChunkProgress,
    writePosition = 0,
  ): Promise<void> {
    try {
      for await (const data of stream) {
        const buffer = data as Buffer;
        try {
          await handle.fd.write(buffer, 0, buffer.length, writePosition);
        } catch (err) {
          throw new DownloadError(
            { code: "fs-error", path: handle.path },
            `Failed to write to ${handle.path}`,
            err,
          );
        }
        writePosition += buffer.length;
        progress.bytesReceived += buffer.length;
      }
    } catch (err) {
      if (err instanceof DownloadError) throw err;
      throw toNetworkError(stream.requestUrl, err);
    }
  }
}

function createHeaders(etag: string | null, chunk: Chunk | null): Headers {
  const range = chunk ? `bytes=${chunk.start}-${chunk.end}` : undefined;

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
