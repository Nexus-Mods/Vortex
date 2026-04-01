import { describe, it, expect } from "vitest";

import { type Chunk, staticChunker } from "./chunking";

function createChunks(size: number, numChunks: number): Chunk[] {
  return staticChunker(numChunks, 1)(size);
}

describe("staticChunker", () => {
  describe("chunk count", () => {
    it("returns the requested number of chunks", () => {
      expect(createChunks(100, 4)).toHaveLength(4);
    });

    it("returns one chunk when numChunks is 1", () => {
      expect(createChunks(100, 1)).toHaveLength(1);
    });
  });

  describe("indices", () => {
    it("assigns sequential zero-based indices", () => {
      const indices = createChunks(100, 4).map((c) => c.index);
      expect(indices).toEqual([0, 1, 2, 3]);
    });
  });

  describe("coverage", () => {
    it("first chunk starts at byte 0", () => {
      const [first] = createChunks(100, 4);
      expect(first.range.start).toBe(0);
    });

    it("last chunk ends at the final byte", () => {
      const chunks = createChunks(100, 4);
      expect(chunks.at(-1).range.end).toBe(99);
    });

    it("covers every byte with no gaps", () => {
      const chunks = createChunks(100, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].range.start).toBe(chunks[i - 1].range.end + 1);
      }
    });

    it("covers every byte with no gaps for an odd-sized file", () => {
      const chunks = createChunks(101, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].range.start).toBe(chunks[i - 1].range.end + 1);
      }
    });

    it("accounts for every byte across all chunks", () => {
      const size = 100;
      const chunks = createChunks(size, 4);
      const total = chunks.reduce(
        (sum, c) => sum + (c.range.end - c.range.start + 1),
        0,
      );
      expect(total).toBe(size);
    });
  });

  describe("chunk boundaries", () => {
    it("produces non-overlapping chunks", () => {
      const chunks = createChunks(100, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].range.start).toBeGreaterThan(chunks[i - 1].range.end);
      }
    });

    it("each chunk has a non-negative size", () => {
      createChunks(100, 4).forEach((c) => {
        expect(c.range.end).toBeGreaterThanOrEqual(c.range.start);
      });
    });
  });

  describe("minimum file size gate", () => {
    it("returns empty when size is below minFileSize", () => {
      const chunker = staticChunker(4, 1024);
      expect(chunker(512)).toHaveLength(0);
    });

    it("returns empty when size equals minFileSize minus one", () => {
      const chunker = staticChunker(4, 1024);
      expect(chunker(1023)).toHaveLength(0);
    });

    it("returns chunks when size equals minFileSize", () => {
      const chunker = staticChunker(4, 1024);
      expect(chunker(1024)).toHaveLength(4);
    });

    it("returns chunks when size exceeds minFileSize", () => {
      const chunker = staticChunker(4, 1024);
      expect(chunker(2048)).toHaveLength(4);
    });
  });

  describe("edge cases", () => {
    it("handles a single byte file", () => {
      const chunks = createChunks(1, 1);
      expect(chunks[0].range.start).toBe(0);
      expect(chunks[0].range.end).toBe(0);
    });

    it("throws when numChunks exceeds file size", () => {
      expect(() => createChunks(3, 4)).toThrow();
    });

    it("handles a file that divides evenly into chunks", () => {
      const chunks = createChunks(100, 4);
      expect(chunks[0].range).toMatchObject({ start: 0, end: 24 });
      expect(chunks[1].range).toMatchObject({ start: 25, end: 49 });
      expect(chunks[2].range).toMatchObject({ start: 50, end: 74 });
      expect(chunks[3].range).toMatchObject({ start: 75, end: 99 });
    });

    it("handles a file that does not divide evenly into chunks", () => {
      const chunks = createChunks(101, 4);
      expect(chunks[0].range).toMatchObject({ start: 0, end: 25 });
      expect(chunks[1].range).toMatchObject({ start: 26, end: 51 });
      expect(chunks[2].range).toMatchObject({ start: 52, end: 77 });
      expect(chunks[3].range).toMatchObject({ start: 78, end: 100 });
    });
  });
});
