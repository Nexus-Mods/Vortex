import got from "got";
import { createWriteStream } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { Chunk, Chunker } from "./chunking";
import type { DownloadProgress, ChunkProgress } from "./progress";
import type { Resolver, NormalizedResource } from "./resolver";

import { staticChunker } from "./chunking";
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

    const promise = this.#downloadQueue.add(async () => {
      const resolved = normalize(await resolver(resource));
      const probe = await this.#probe(resolved.probeUrl);

      const chunks = probe.acceptsRanges
        ? await Promise.resolve(chunker(probe.size, resource))
        : [];

      progressReporter.init(chunks, probe.size > 0 ? probe.size : null);

      if (chunks.length === 0) {
        return this.#chunkQueue.add(() =>
          this.#downloadStream(
            got.stream(resolved.probeUrl),
            dest,
            progressReporter.chunkProgress[0],
          ),
        );
      }

      return this.#downloadChunked(
        resolved,
        dest,
        probe,
        chunks,
        progressReporter.chunkProgress,
      );
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

  async #downloadChunked(
    resource: NormalizedResource,
    dest: string,
    probe: ProbeResult,
    chunks: Chunk[],
    chunkProgress: ChunkProgress[],
  ): Promise<void> {
    const fd = await open(dest, "w");

    try {
      await fd.truncate(probe.size);

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
    } finally {
      await fd.close();
    }
  }

  async #downloadStream(
    stream: ReturnType<typeof got.stream>,
    dest: string | FileHandle,
    progress: ChunkProgress,
    writePosition = 0,
  ): Promise<void> {
    if (typeof dest === "string") {
      const fileStream = createWriteStream(dest);
      stream.on("data", (data: Buffer) => {
        progress.bytesReceived += data.length;
      });
      return pipeline(stream, fileStream);
    }

    for await (const data of stream) {
      const buffer = data as Buffer;
      await dest.write(buffer, 0, buffer.length, writePosition);
      writePosition += buffer.length;
      progress.bytesReceived += buffer.length;
    }
  }
}

type ProbeResult = {
  size: number;
  acceptsRanges: boolean;
};
