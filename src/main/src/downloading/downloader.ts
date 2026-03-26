import type { URL } from "node:url";

import got from "got";
import { createWriteStream } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import PQueue from "p-queue";

import { type Chunk, createChunks } from "./chunking";

export type DownloaderOptions = {
  /** Maximum simultaneous file downloads */
  downloadConcurrency: number;
  /** Maximum simultaneous chunk connections across all downloads */
  chunkConcurrency: number;
  /** Number of chunks to split a file into when the server supports ranges */
  chunksPerFile: number;
  /** Minimum file size in bytes before chunking is attempted */
  minFileSizeForChunking: number;
};

/** Creates instance of the options with default values */
export function defaultOptions(): DownloaderOptions {
  return {
    downloadConcurrency: 3,
    chunkConcurrency: 6,
    chunksPerFile: 4,
    minFileSizeForChunking: 10 * 1024 * 1024,
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

  download(url: URL, dest: string): Promise<void> {
    return this.#downloadQueue.add(async () => {
      const probe = await this.#probe(url);

      return probe.chunkable
        ? this.#downloadChunked(url, dest, probe)
        : this.#downloadSingle(url, dest, probe);
    });
  }

  async #probe(url: URL): Promise<ProbeResult> {
    const response = await got.head(url);

    const contentLength = response.headers["content-length"];
    let size = contentLength ? parseInt(contentLength, 10) : 0;
    size = isNaN(size) ? 0 : size;

    const acceptsRanges = response.headers["accept-ranges"] === "bytes";
    const chunkable =
      acceptsRanges && size >= this.#options.minFileSizeForChunking;

    return { size, chunkable };
  }

  async #downloadSingle(url: URL, dest: string, _probeResult: ProbeResult) {
    return this.#chunkQueue.add(() =>
      pipeline(got.stream(url), createWriteStream(dest)),
    );
  }

  async #downloadChunked(
    url: URL,
    dest: string,
    probeResult: ProbeResult,
  ): Promise<void> {
    const { size } = probeResult;
    const chunks = createChunks(size, this.#options.chunksPerFile);

    const fd = await open(dest, "w");
    await fd.truncate(size);

    try {
      await Promise.all(
        chunks.map((chunk) =>
          this.#chunkQueue.add(() => this.#downloadChunk(url, chunk, fd)),
        ),
      );
    } finally {
      await fd.close();
    }
  }

  async #downloadChunk(url: URL, chunk: Chunk, fd: FileHandle): Promise<void> {
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
    }
  }
}

type ProbeResult = {
  size: number;
  chunkable: boolean;
};
