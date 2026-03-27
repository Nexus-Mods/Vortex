import got from "got";
import { createWriteStream } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { type URL } from "node:url";
import PQueue from "p-queue";

import type { Resolver, NormalizedResource } from "./resolver";

import { type Chunk, createChunks } from "./chunking";
import { normalize } from "./resolver";

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

  download<T>(resource: T, resolver: Resolver<T>, dest: string): Promise<void> {
    return this.#downloadQueue.add(async () => {
      const resolved = normalize(await resolver(resource));
      const probe = await this.#probe(resolved.probeUrl);

      return probe.chunkable
        ? this.#downloadChunked(resolved, dest, probe)
        : this.#downloadSingle(resolved.probeUrl, dest);
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

  async #downloadSingle(url: URL, dest: string) {
    return this.#chunkQueue.add(() =>
      pipeline(got.stream(url), createWriteStream(dest)),
    );
  }

  async #downloadChunked(
    resource: NormalizedResource,
    dest: string,
    probeResult: ProbeResult,
  ): Promise<void> {
    const { size } = probeResult;
    const chunks = createChunks(size, this.#options.chunksPerFile);

    const fd = await open(dest, "w");

    try {
      await fd.truncate(size);

      await Promise.all(
        chunks.map((chunk) =>
          this.#chunkQueue.add(() => this.#downloadChunk(resource, chunk, fd)),
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
    }
  }
}

type ProbeResult = {
  size: number;
  chunkable: boolean;
};
