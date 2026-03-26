export type Chunk = {
  index: number;
  start: number;
  end: number;
};

export function createChunks(size: number, numChunks: number): Chunk[] {
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
}
