import { describe, it, expect } from "vitest";

import { createChunks } from "./chunking";

describe("createChunks", () => {
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
      expect(first.start).toBe(0);
    });

    it("last chunk ends at the final byte", () => {
      const chunks = createChunks(100, 4);
      expect(chunks.at(-1).end).toBe(99);
    });

    it("covers every byte with no gaps", () => {
      const chunks = createChunks(100, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].start).toBe(chunks[i - 1].end + 1);
      }
    });

    it("covers every byte with no gaps for an odd-sized file", () => {
      const chunks = createChunks(101, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].start).toBe(chunks[i - 1].end + 1);
      }
    });

    it("accounts for every byte across all chunks", () => {
      const size = 100;
      const chunks = createChunks(size, 4);
      const total = chunks.reduce((sum, c) => sum + (c.end - c.start + 1), 0);
      expect(total).toBe(size);
    });
  });

  describe("chunk boundaries", () => {
    it("produces non-overlapping chunks", () => {
      const chunks = createChunks(100, 4);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].end);
      }
    });

    it("each chunk has a non-negative size", () => {
      createChunks(100, 4).forEach((c) => {
        expect(c.end).toBeGreaterThanOrEqual(c.start);
      });
    });
  });

  describe("edge cases", () => {
    it("handles a single byte file", () => {
      const chunks = createChunks(1, 1);
      expect(chunks[0].start).toBe(0);
      expect(chunks[0].end).toBe(0);
    });

    it("handles a file that divides evenly into chunks", () => {
      const chunks = createChunks(100, 4);
      expect(chunks[0]).toMatchObject({ start: 0, end: 24 });
      expect(chunks[1]).toMatchObject({ start: 25, end: 49 });
      expect(chunks[2]).toMatchObject({ start: 50, end: 74 });
      expect(chunks[3]).toMatchObject({ start: 75, end: 99 });
    });

    it("handles a file that does not divide evenly into chunks", () => {
      const chunks = createChunks(101, 4);
      expect(chunks[0]).toMatchObject({ start: 0, end: 25 });
      expect(chunks[1]).toMatchObject({ start: 26, end: 51 });
      expect(chunks[2]).toMatchObject({ start: 52, end: 77 });
      expect(chunks[3]).toMatchObject({ start: 78, end: 100 });
    });
  });
});
