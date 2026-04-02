import type { ByteRange, Chunk } from "./chunking";

export type Progress = {
  bytesReceived: number;
  bytesWritten: number;
};

export type ChunkProgress = Progress & {
  chunkRange: ByteRange;
};

export type DownloadProgress = Progress & {
  /** Size of the file being downloaded. This can be null when the server returns no size. */
  size: number | null;
} & ({ isChunked: false } | { isChunked: true; chunks: ChunkProgress[] });

export type ProgressCallback = (progress: DownloadProgress) => void;

/** @internal */
export class ProgressReporter {
  #isChunked: boolean = false;
  #chunkProgress: ChunkProgress[] = [];
  #progress: Progress = { bytesReceived: 0, bytesWritten: 0 };

  public size: number | null = null;

  public get isChunked(): boolean {
    return this.#isChunked;
  }

  public initChunked(chunks: Chunk[], size: number): ChunkProgress[] {
    this.size = size;
    this.#isChunked = true;

    const chunkProgress = chunks.map<ChunkProgress>((c) => ({
      chunkRange: c.range,
      bytesReceived: 0,
      bytesWritten: 0,
    }));

    this.#chunkProgress = chunkProgress;
    return chunkProgress;
  }

  public init(size: number | null): Progress {
    this.size = size;
    this.#isChunked = false;

    const progress: Progress = {
      bytesReceived: 0,
      bytesWritten: 0,
    };

    this.#progress = progress;
    return progress;
  }

  public getProgress(): DownloadProgress {
    let bytesReceived = 0;
    let bytesWritten = 0;

    if (this.#isChunked) {
      bytesReceived = this.#chunkProgress.reduce(
        (sum, c) => sum + c.bytesReceived,
        0,
      );

      bytesWritten = this.#chunkProgress.reduce(
        (sum, c) => sum + c.bytesWritten,
        0,
      );
    } else {
      bytesReceived = this.#progress.bytesReceived;
      bytesWritten = this.#progress.bytesWritten;
    }

    const progress = {
      size: this.size,
      bytesReceived,
      bytesWritten,
    };

    if (this.#isChunked) {
      return {
        ...progress,
        isChunked: true,
        chunks: this.#chunkProgress,
      };
    }

    return {
      ...progress,
      isChunked: false,
    };
  }
}
