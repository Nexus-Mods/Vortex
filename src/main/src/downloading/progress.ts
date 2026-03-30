import type { Chunk } from "./chunking";

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

export class ProgressReporter {
  #chunkProgress: ChunkProgress[];
  #totalBytes: number | null;

  get chunkProgress(): ChunkProgress[] {
    return this.#chunkProgress;
  }

  public init(chunks: Chunk[], totalBytes: number | null): void {
    this.#totalBytes = totalBytes;

    if (chunks.length === 0) {
      this.#chunkProgress = [
        {
          chunkIndex: 0,
          bytesReceived: 0,
          totalBytes: this.#totalBytes,
        },
      ];
    } else {
      this.#chunkProgress = chunks.map((chunk) => ({
        chunkIndex: chunk.index,
        bytesReceived: 0,
        totalBytes: chunk.end - chunk.start + 1,
      }));
    }
  }

  public getProgress(): DownloadProgress {
    const bytesReceived = this.#chunkProgress.reduce(
      (sum, c) => sum + c.bytesReceived,
      0,
    );

    return {
      bytesReceived,
      totalBytes: this.#totalBytes,
      chunks: this.#chunkProgress,
    };
  }
}
