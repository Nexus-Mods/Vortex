export type Chunk = {
  index: number;
  start: number;
  end: number;
};

/**
 * Gets invoked to create chunks from a resource. Return an empty array
 * if chunking isn't supported.
 * */
export type Chunker<T> = (
  size: number,
  resource: T,
) => Chunk[] | Promise<Chunk[]>;

/** Creates a chunker that splits into n same-sized chunks */
export function staticChunker(
  numChunks: number = 4,
  minFileSize: number = 10 * 1024 * 1024,
) {
  const f = (size: number): Chunk[] => {
    if (size < minFileSize) return [];
    if (numChunks > size) {
      throw new Error(
        `Cannot create ${numChunks} chunks from ${size} bytes: each chunk must cover at least 1 byte`,
      );
    }

    const chunkSize = Math.ceil(size / numChunks);
    const chunks = Array.from({ length: numChunks }, (_, i) => ({
      index: i,
      start: i * chunkSize,
      end: Math.min(i * chunkSize + chunkSize - 1, size - 1),
    }));

    return chunks;
  };

  return f satisfies Chunker<never>;
}
