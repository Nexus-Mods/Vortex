/**
 * A range starting at 0 with a length of 500 bytes is represented as start=0, end=499
 */
export type ByteRange = {
  start: number;
  end: number;
};

export type Chunk = {
  index: number;
  range: ByteRange;
};

/**
 * Gets invoked to create chunks from a resource. Return an empty array
 * if chunking isn't supported.
 */
export type Chunker<T> = (
  size: number,
  resource: T,
) => Chunk[] | Promise<Chunk[]>;

/** Creates a chunker that splits into n same-sized chunks */
export function staticChunker(
  numChunks: number = 4,
  minFileSize: number = 10 * 1024 * 1024,
): (size: number) => Chunk[] {
  const f = (size: number): Chunk[] => {
    if (size < minFileSize) return [];
    if (numChunks > size) {
      throw new Error(
        `Cannot create ${numChunks} chunks from ${size} bytes: each chunk must cover at least 1 byte`,
      );
    }

    const chunkSize = Math.ceil(size / numChunks);
    const chunks = Array.from(
      { length: numChunks },
      (_, i): Chunk => ({
        index: i,
        range: {
          start: i * chunkSize,
          end: Math.min(i * chunkSize + chunkSize - 1, size - 1),
        },
      }),
    );

    return chunks;
  };

  return f satisfies Chunker<never>;
}

export type ResolvedEndpoint = { url: URL; headers?: Record<string, string> };

export type ResolvedResource =
  | ResolvedEndpoint
  | {
      probeEndpoint: ResolvedEndpoint;
      chunkEndpoint?: (chunk: Chunk) => Promise<ResolvedEndpoint>;
    };

export type Resolver<T> = (resource: T) => Promise<ResolvedResource>;

/** A retry strategy that never retries. */
export const noRetry: RetryStrategy = () => ({ retry: false });

/** The verdict returned by a {@link RetryStrategy}. */
export type RetryVerdict = { retry: true; delayMs: number } | { retry: false };

/** Context passed to the retry strategy for each failure. */
export type RetryContext = {
  /** Which attempt just failed (1-based: 1 = first failure, 2 = second, etc.) */
  attempt: number;
  /** The error from the failed attempt. */
  error: Error;
};

/**
 * Decides whether a failed chunk should be retried and how long to wait.
 * Returning `{ retry: false }` stops retrying and lets the error propagate.
 */
export type RetryStrategy = (context: RetryContext) => RetryVerdict;

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
