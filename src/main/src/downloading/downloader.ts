import got from "got";
import { createWriteStream } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { Chunk, Chunker } from "./chunking";
import type { Resolver, NormalizedResource } from "./resolver";

import { staticChunker } from "./chunking";
import { normalize } from "./resolver";

export type DownloaderOptions = {
  /** Maximum simultaneous file downloads */
  downloadConcurrency: number;
  /** Maximum simultaneous chunk connections across all downloads */
  chunkConcurrency: number;
};

export type ChunkProgress = {
  chunkIndex: number;
  bytesReceived: number;
  totalBytes: number;
};

export type DownloadProgress = {
  bytesReceived: number;
  totalBytes: number | null;
  chunks: ChunkProgress[];
};

export type ProgressCallback = (progress: DownloadProgress) => void;

export type DownloadHandle = {
  readonly promise: Promise<void>;
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
    let getProgress: () => DownloadProgress = () => ({
      bytesReceived: 0,
      totalBytes: null,
      chunks: [],
    });

    const promise = this.#downloadQueue.add(async () => {
      const resolved = normalize(await resolver(resource));
      const probe = await this.#probe(resolved.probeUrl);

      const chunks = probe.acceptsRanges
        ? await Promise.resolve(chunker(probe.size, resource))
        : [];

      if (chunks.length === 0) {
        const singleProgress = this.#createSingleProgress(probe);
        return this.#downloadSingle(resolved.probeUrl, dest, singleProgress);
      }

      const chunkProgress: ChunkProgress[] = chunks.map((chunk) => ({
        chunkIndex: chunk.index,
        bytesReceived: 0,
        totalBytes: chunk.end - chunk.start + 1,
      }));

      getProgress = () => {
        const bytesReceived = chunkProgress.reduce(
          (sum, c) => sum + c.bytesReceived,
          0,
        );
        return { bytesReceived, totalBytes: probe.size, chunks: chunkProgress };
      };

      return this.#downloadChunked(
        resolved,
        dest,
        probe,
        chunks,
        chunkProgress,
      );
    });

    return {
      promise,
      getProgress,
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

  async #downloadSingle(url: URL, dest: string, progress: SingleProgress) {
    return this.#chunkQueue.add(() => {
      const stream = got.stream(url);

      stream.on("data", (data: Buffer) => progress.increment(data.length));
      return pipeline(stream, createWriteStream(dest));
    });
  }

  async #downloadChunked(
    resource: NormalizedResource,
    dest: string,
    probeResult: ProbeResult,
    chunks: Chunk[],
    chunkProgress: ChunkProgress[],
  ): Promise<void> {
    const fd = await open(dest, "w");

    try {
      await fd.truncate(probeResult.size);

      await Promise.all(
        chunks.map((chunk) =>
          this.#chunkQueue.add(() =>
            this.#downloadChunk(resource, chunk, fd, chunkProgress),
          ),
        ),
      );
    } finally {
      await fd.close();
    }
  }

  async #downloadChunk(
    resource: NormalizedResource,
    chunk: Chunk,
    fd: FileHandle,
    chunkProgress: ChunkProgress[],
  ): Promise<void> {
    const url = await resource.chunkUrl(chunk);

    const stream = got.stream(url, {
      headers: {
        Range: `bytes=${chunk.start}-${chunk.end}`,
      },
    });

    let writePosition = chunk.start;

    for await (const data of stream) {
      const buffer = data as Buffer;

      await fd.write(buffer, 0, buffer.length, writePosition);
      writePosition += buffer.length;
      chunkProgress[chunk.index].bytesReceived += buffer.length;
    }
  }

  #createSingleProgress(probe: ProbeResult): SingleProgress {
    const totalBytes = probe.size > 0 ? probe.size : null;
    let bytesReceived = 0;

    return {
      increment: (n) => {
        bytesReceived += n;
      },
      getProgress: () => ({ bytesReceived, totalBytes, chunks: [] }),
    };
  }
}

type ProbeResult = {
  size: number;
  acceptsRanges: boolean;
};

type SingleProgress = {
  increment: (n: number) => void;
  getProgress: () => DownloadProgress;
};
