import got from "got";
import { type WriteStream } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
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
        throw new DownloadError("resolver-error", "Resolver failed", err);
      }

      let probe: ProbeResult;
      try {
        probe = await this.#probe(resolved.probeUrl);
      } catch (err) {
        throw toNetworkError(err);
      }

      const chunks = probe.acceptsRanges
        ? await Promise.resolve(chunker(probe.size, resource))
        : [];

      progressReporter.init(chunks, probe.size > 0 ? probe.size : null);

      let fd: FileHandle;

      try {
        fd = await open(dest, "w");
      } catch (err) {
        throw new DownloadError(
          "fs-error",
          "Failed to open destination file",
          err,
        );
      }

      try {
        if (chunks.length === 0) {
          await this.#downloadSingle(
            got.stream(resolved.probeUrl),
            fd,
            progressReporter.chunkProgress[0],
          );
        } else {
          try {
            await fd.truncate(probe.size);
          } catch (err) {
            throw new DownloadError(
              "fs-error",
              "Failed to truncate destination file",
              err,
            );
          }

          await this.#downloadChunked(
            resolved,
            fd,
            chunks,
            progressReporter.chunkProgress,
          );
        }
      } finally {
        await fd.close();
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
    return { size, acceptsRanges };
  }

  async #downloadSingle(
    stream: ReturnType<typeof got.stream>,
    fd: FileHandle,
    progress: ChunkProgress,
  ): Promise<void> {
    let fileStream: WriteStream;

    try {
      fileStream = fd.createWriteStream({ autoClose: false });
    } catch (err) {
      throw new DownloadError("fs-error", "Failed to create write stream", err);
    }

    try {
      stream.on("data", (data: Buffer) => {
        progress.bytesReceived += data.length;
      });

      await pipeline(stream, fileStream);
    } catch (err) {
      throw toNetworkError(err);
    } finally {
      fileStream.destroy();
    }
  }

  async #downloadChunked(
    resource: NormalizedResource,
    fd: FileHandle,
    chunks: Chunk[],
    chunkProgress: ChunkProgress[],
  ): Promise<void> {
    await Promise.all(
      chunks.map((chunk) =>
        this.#chunkQueue.add(async () => {
          const url = await resource.chunkUrl(chunk);
          const stream = got.stream(url, {
            headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
          });

          const result = await this.#downloadStream(
            stream,
            fd,
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
    fd: FileHandle,
    progress: ChunkProgress,
    writePosition = 0,
  ): Promise<void> {
    try {
      for await (const data of stream) {
        const buffer = data as Buffer;
        try {
          await fd.write(buffer, 0, buffer.length, writePosition);
        } catch (err) {
          throw new DownloadError(
            "fs-error",
            "Failed to write to destination file",
            err,
          );
        }
        writePosition += buffer.length;
        progress.bytesReceived += buffer.length;
      }
    } catch (err) {
      if (err instanceof DownloadError) throw err;
      throw toNetworkError(err);
    }
  }
}

type ProbeResult = {
  size: number;
  acceptsRanges: boolean;
};
