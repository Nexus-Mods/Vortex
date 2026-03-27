export type Chunk = {
  index: number;
  start: number;
  end: number;
};

export type Chunker<T> = (size: number, resource: T) => Chunk[];

/** Creates a chunker that splits into n same-sized chunks */
export function staticChunker(numChunks: number) {
  const f = (size: number): Chunk[] => {
    if (numChunks > size) {
      throw new Error(
        `Cannot create ${numChunks} chunks from ${size} bytes: each chunk must cover at least 1 byte`,
      );
    }

    const chunkSize = Math.ceil(size / numChunks);

    return Array.from({ length: numChunks }, (_, i) => ({
      index: i,
      start: i * chunkSize,
      end: Math.min(i * chunkSize + chunkSize - 1, size - 1),
    }));
  };

  return f satisfies Chunker<never>;
}
