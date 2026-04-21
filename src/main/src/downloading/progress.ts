import type {
  Chunk,
  ChunkProgress,
  DownloadProgress,
  Progress,
} from "@vortex/shared/download";

export type DownloadStatus =
  | "queued"
  | "running"
  | "completed"
  | "paused"
  | "canceled"
  | "failed";

/** @internal */
export class ProgressReporter {
  #status: DownloadStatus = "queued";
  get status(): DownloadStatus {
    return this.#status;
  }

  set status(value: DownloadStatus) {
    this.#status = value;
  }

  #isChunked: boolean = false;
  #chunkProgress: Map<number, ChunkProgress> = new Map();
  #progress: Progress = { bytesReceived: 0, bytesWritten: 0 };

  public size: number | null = null;
  public etag: string | null = null;

  public get isChunked(): boolean {
    return this.#isChunked;
  }

  public initChunked(
    chunks: Chunk[],
    size: number,
  ): Map<number, ChunkProgress> {
    this.size = size;
    this.#isChunked = true;

    const chunkProgress = new Map<number, ChunkProgress>();
    for (const chunk of chunks) {
      chunkProgress.set(chunk.index, {
        chunkRange: chunk.range,
        bytesReceived: 0,
        bytesWritten: 0,
      });
    }

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
      bytesReceived = this.#chunkProgress
        .values()
        .reduce((sum, c) => sum + c.bytesReceived, 0);
      bytesWritten = this.#chunkProgress
        .values()
        .reduce((sum, c) => sum + c.bytesWritten, 0);
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
        chunks: this.#chunkProgress.values().toArray(),
      };
    }

    return {
      ...progress,
      isChunked: false,
    };
  }
}
