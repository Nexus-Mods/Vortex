import type { ByteRange, Chunk } from "./chunking";

export type ChunkProgress = {
  chunkIndex: number;
  chunkRange: ByteRange;
  bytesReceived: number;
  bytesWritten: number;
};

export type DownloadProgress = {
  isChunked: boolean;
  bytesReceived: number;
  bytesWritten: number;
  totalBytes: number | null;
  chunks: ChunkProgress[];
};

export type ProgressCallback = (progress: DownloadProgress) => void;

export class ProgressReporter {
  #chunkProgress: ChunkProgress[] = [];
  #totalBytes: number | null = null;
  #isChunked: boolean = false;

  get isChunked(): boolean {
    return this.#isChunked;
  }

  get chunkProgress(): ChunkProgress[] {
    return this.#chunkProgress;
  }

  public init(chunks: Chunk[], totalBytes: number | null): void {
    this.#totalBytes = totalBytes;
    this.#isChunked = chunks.length !== 0;

    if (chunks.length === 0) {
      this.#chunkProgress = [
        {
          chunkIndex: 0,
          chunkRange: { start: 0, end: this.#totalBytes },
          bytesReceived: 0,
          bytesWritten: 0,
        },
      ];
    } else {
      this.#chunkProgress = chunks.map<ChunkProgress>((chunk) => ({
        chunkIndex: chunk.index,
        chunkRange: chunk.range,
        bytesReceived: 0,
        bytesWritten: 0,
      }));
    }
  }

  public getProgress(): DownloadProgress {
    const bytesReceived = this.#chunkProgress.reduce(
      (sum, c) => sum + c.bytesReceived,
      0,
    );

    const bytesWritten = this.#chunkProgress.reduce(
      (sum, c) => sum + c.bytesWritten,
      0,
    );

    return {
      isChunked: this.isChunked,
      bytesReceived,
      bytesWritten,
      totalBytes: this.#totalBytes,
      chunks: this.#chunkProgress,
    };
  }
}
