import type { Chunk } from "@vortex/shared/download";
import { describe, it, expect, beforeEach } from "vitest";

import { ProgressReporter } from "./progress";

function makeChunk(index: number, start: number, end: number): Chunk {
  return { index, range: { start, end } };
}

describe("ProgressReporter", () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter();
  });

  describe("init (non-chunked)", () => {
    it("sets size from the provided value", () => {
      reporter.init(1024);
      expect(reporter.getProgress().size).toBe(1024);
    });

    it("sets size to null when unknown", () => {
      reporter.init(null);
      expect(reporter.getProgress().size).toBeNull();
    });

    it("sets isChunked to false", () => {
      reporter.init(1024);
      expect(reporter.getProgress().isChunked).toBe(false);
    });

    it("returns a Progress object with bytesReceived and bytesWritten initialised to zero", () => {
      const progress = reporter.init(1024);
      expect(progress.bytesReceived).toBe(0);
      expect(progress.bytesWritten).toBe(0);
    });

    it("reflects mutations to the returned Progress object in getProgress", () => {
      const progress = reporter.init(1024);
      progress.bytesReceived = 300;
      progress.bytesWritten = 300;
      const result = reporter.getProgress();
      expect(result.bytesReceived).toBe(300);
      expect(result.bytesWritten).toBe(300);
    });

    it("incremental updates to bytesReceived are reflected in getProgress", () => {
      const progress = reporter.init(1024);
      progress.bytesReceived = 100;
      expect(reporter.getProgress().bytesReceived).toBe(100);
      progress.bytesReceived = 600;
      expect(reporter.getProgress().bytesReceived).toBe(600);
    });

    it("incremental updates to bytesWritten are reflected in getProgress", () => {
      const progress = reporter.init(1024);
      progress.bytesWritten = 100;
      expect(reporter.getProgress().bytesWritten).toBe(100);
      progress.bytesWritten = 600;
      expect(reporter.getProgress().bytesWritten).toBe(600);
    });

    it("does not include chunks in the returned progress", () => {
      reporter.init(1024);
      const result = reporter.getProgress();
      expect(result.isChunked).toBe(false);
      expect("chunks" in result).toBe(false);
    });
  });

  describe("initChunked", () => {
    it("sets size from the provided value", () => {
      reporter.initChunked([], 1024);
      expect(reporter.getProgress().size).toBe(1024);
    });

    it("sets isChunked to true when chunks are provided", () => {
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().isChunked).toBe(true);
    });

    it("returns one ChunkProgress entry per chunk", () => {
      const chunkProgress = reporter.initChunked(
        [makeChunk(0, 0, 499), makeChunk(1, 500, 999)],
        1000,
      );
      expect(chunkProgress).toHaveLength(2);
    });

    it("copies the chunk range onto each ChunkProgress entry", () => {
      const chunkProgress = reporter.initChunked(
        [makeChunk(0, 0, 499), makeChunk(1, 500, 999)],
        1000,
      );
      expect(chunkProgress.get(0).chunkRange).toEqual({ start: 0, end: 499 });
      expect(chunkProgress.get(1).chunkRange).toEqual({ start: 500, end: 999 });
    });

    it("initialises each ChunkProgress bytesReceived and bytesWritten to zero", () => {
      const chunkProgress = reporter.initChunked(
        [makeChunk(0, 0, 499), makeChunk(1, 500, 999)],
        1000,
      );
      expect(chunkProgress.values().every((c) => c.bytesReceived === 0)).toBe(true);
      expect(chunkProgress.values().every((c) => c.bytesWritten === 0)).toBe(true);
    });

    it("returns an empty array when called with no chunks", () => {
      const chunkProgress = reporter.initChunked([], 1024);
      expect(chunkProgress).toHaveLength(0);
    });
  });

  describe("getProgress (chunked)", () => {
    it("returns zero bytesReceived before any progress", () => {
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().bytesReceived).toBe(0);
    });

    it("returns zero bytesWritten before any progress", () => {
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().bytesWritten).toBe(0);
    });

    it("sums bytesReceived across all chunks", () => {
      const chunkProgress = reporter.initChunked(
        [makeChunk(0, 0, 499), makeChunk(1, 500, 999)],
        1000,
      );
      chunkProgress.get(0).bytesReceived = 200;
      chunkProgress.get(1).bytesReceived = 350;
      expect(reporter.getProgress().bytesReceived).toBe(550);
    });

    it("sums bytesWritten across all chunks", () => {
      const chunkProgress = reporter.initChunked(
        [makeChunk(0, 0, 499), makeChunk(1, 500, 999)],
        1000,
      );
      chunkProgress.get(0).bytesWritten = 200;
      chunkProgress.get(1).bytesWritten = 350;
      expect(reporter.getProgress().bytesWritten).toBe(550);
    });

    it("reflects incremental updates to chunk bytesReceived", () => {
      const chunkProgress = reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      chunkProgress.get(0).bytesReceived = 100;
      expect(reporter.getProgress().bytesReceived).toBe(100);
      chunkProgress.get(0).bytesReceived = 600;
      expect(reporter.getProgress().bytesReceived).toBe(600);
    });

    it("reflects incremental updates to chunk bytesWritten", () => {
      const chunkProgress = reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      chunkProgress.get(0).bytesWritten = 100;
      expect(reporter.getProgress().bytesWritten).toBe(100);
      chunkProgress.get(0).bytesWritten = 600;
      expect(reporter.getProgress().bytesWritten).toBe(600);
    });

    it("exposes the chunks array in the returned progress", () => {
      const chunkProgress = reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      const result = reporter.getProgress();
      expect(result.isChunked).toBe(true);
      if (result.isChunked) {
        expect(result.chunks).toStrictEqual(chunkProgress.values().toArray());
      }
    });
  });

  describe("re-initialisation", () => {
    it("resets to non-chunked state after switching from chunked", () => {
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      reporter.init(512);
      const result = reporter.getProgress();
      expect(result.isChunked).toBe(false);
      expect(result.size).toBe(512);
      expect(result.bytesReceived).toBe(0);
      expect(result.bytesWritten).toBe(0);
    });

    it("resets to chunked state after switching from non-chunked", () => {
      reporter.init(512);
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      const result = reporter.getProgress();
      expect(result.isChunked).toBe(true);
      expect(result.size).toBe(1000);
      expect(result.bytesReceived).toBe(0);
      expect(result.bytesWritten).toBe(0);
    });

    it("old Progress reference no longer affects getProgress after re-init via init", () => {
      const old = reporter.init(512);
      old.bytesReceived = 512;
      reporter.init(1024);
      expect(reporter.getProgress().bytesReceived).toBe(0);
    });

    it("old ChunkProgress array no longer affects getProgress after re-init via initChunked", () => {
      const old = reporter.initChunked([makeChunk(0, 0, 499)], 500);
      old.get(0).bytesReceived = 500;
      reporter.initChunked([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().bytesReceived).toBe(0);
    });
  });
});
