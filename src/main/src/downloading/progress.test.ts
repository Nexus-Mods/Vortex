import { describe, it, expect, beforeEach } from "vitest";

import type { Chunk } from "./chunking";

import { ProgressReporter } from "./progress";

function makeChunk(index: number, start: number, end: number): Chunk {
  return { index, start, end };
}

describe("ProgressReporter", () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter();
  });

  describe("init", () => {
    it("sets totalBytes from the provided value", () => {
      reporter.init([], 1024);
      expect(reporter.getProgress().totalBytes).toBe(1024);
    });

    it("sets totalBytes to null when unknown", () => {
      reporter.init([], null);
      expect(reporter.getProgress().totalBytes).toBeNull();
    });

    it("sets isChunked to false when no chunks are provided", () => {
      reporter.init([], 1024);
      expect(reporter.getProgress().isChunked).toBe(false);
    });

    it("sets isChunked to true when chunks are provided", () => {
      reporter.init([makeChunk(0, 0, 499), makeChunk(1, 500, 999)], 1000);
      expect(reporter.getProgress().isChunked).toBe(true);
    });

    describe("with no chunks (single download)", () => {
      it("creates one synthetic chunk with index 0", () => {
        reporter.init([], 1024);
        expect(reporter.chunkProgress).toHaveLength(1);
        expect(reporter.chunkProgress[0].chunkIndex).toBe(0);
      });

      it("sets synthetic chunk start to 0", () => {
        reporter.init([], 1024);
        expect(reporter.chunkProgress[0].chunkStart).toBe(0);
      });

      it("sets synthetic chunk chunkEnd to totalBytes", () => {
        reporter.init([], 1024);
        expect(reporter.chunkProgress[0].chunkEnd).toBe(1024);
      });

      it("sets synthetic chunk chunkEnd to null when totalBytes is null", () => {
        reporter.init([], null);
        expect(reporter.chunkProgress[0].chunkEnd).toBeNull();
      });

      it("initialises synthetic chunk bytesReceived to zero", () => {
        reporter.init([], 1024);
        expect(reporter.chunkProgress[0].bytesReceived).toBe(0);
      });

      it("initialises synthetic chunk bytesWritten to zero", () => {
        reporter.init([], 1024);
        expect(reporter.chunkProgress[0].bytesWritten).toBe(0);
      });
    });

    describe("with chunks", () => {
      const chunks = [makeChunk(0, 0, 499), makeChunk(1, 500, 999)];

      it("creates one entry per chunk", () => {
        reporter.init(chunks, 1000);
        expect(reporter.chunkProgress).toHaveLength(2);
      });

      it("preserves chunk indices", () => {
        reporter.init(chunks, 1000);
        expect(reporter.chunkProgress.map((c) => c.chunkIndex)).toEqual([0, 1]);
      });

      it("copies chunkStart and chunkEnd from the chunk byte range", () => {
        reporter.init(chunks, 1000);
        expect(reporter.chunkProgress[0].chunkStart).toBe(0);
        expect(reporter.chunkProgress[0].chunkEnd).toBe(499);
        expect(reporter.chunkProgress[1].chunkStart).toBe(500);
        expect(reporter.chunkProgress[1].chunkEnd).toBe(999);
      });

      it("initialises each chunk bytesReceived to zero", () => {
        reporter.init(chunks, 1000);
        expect(reporter.chunkProgress.every((c) => c.bytesReceived === 0)).toBe(
          true,
        );
      });

      it("initialises each chunk bytesWritten to zero", () => {
        reporter.init(chunks, 1000);
        expect(reporter.chunkProgress.every((c) => c.bytesWritten === 0)).toBe(
          true,
        );
      });
    });
  });

  describe("getProgress", () => {
    it("returns zero bytesReceived before any progress", () => {
      reporter.init([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().bytesReceived).toBe(0);
    });

    it("returns zero bytesWritten before any progress", () => {
      reporter.init([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().bytesWritten).toBe(0);
    });

    it("sums bytesReceived across all chunks", () => {
      reporter.init([makeChunk(0, 0, 499), makeChunk(1, 500, 999)], 1000);
      reporter.chunkProgress[0].bytesReceived = 200;
      reporter.chunkProgress[1].bytesReceived = 350;
      expect(reporter.getProgress().bytesReceived).toBe(550);
    });

    it("sums bytesWritten across all chunks", () => {
      reporter.init([makeChunk(0, 0, 499), makeChunk(1, 500, 999)], 1000);
      reporter.chunkProgress[0].bytesWritten = 200;
      reporter.chunkProgress[1].bytesWritten = 350;
      expect(reporter.getProgress().bytesWritten).toBe(550);
    });

    it("reflects incremental updates to bytesReceived", () => {
      reporter.init([makeChunk(0, 0, 999)], 1000);
      reporter.chunkProgress[0].bytesReceived = 100;
      expect(reporter.getProgress().bytesReceived).toBe(100);
      reporter.chunkProgress[0].bytesReceived = 600;
      expect(reporter.getProgress().bytesReceived).toBe(600);
    });

    it("reflects incremental updates to bytesWritten", () => {
      reporter.init([makeChunk(0, 0, 999)], 1000);
      reporter.chunkProgress[0].bytesWritten = 100;
      expect(reporter.getProgress().bytesWritten).toBe(100);
      reporter.chunkProgress[0].bytesWritten = 600;
      expect(reporter.getProgress().bytesWritten).toBe(600);
    });

    it("returns the same chunkProgress array reference", () => {
      reporter.init([makeChunk(0, 0, 999)], 1000);
      expect(reporter.getProgress().chunks).toBe(reporter.chunkProgress);
    });

    it("returns totalBytes as null when initialised with null", () => {
      reporter.init([], null);
      expect(reporter.getProgress().totalBytes).toBeNull();
    });

    it("resets all counters and replaces chunks after re-initialisation", () => {
      reporter.init([makeChunk(0, 0, 499)], 500);
      reporter.chunkProgress[0].bytesReceived = 500;
      reporter.chunkProgress[0].bytesWritten = 500;

      reporter.init([makeChunk(0, 0, 999)], 1000);
      const progress = reporter.getProgress();
      expect(progress.bytesReceived).toBe(0);
      expect(progress.bytesWritten).toBe(0);
      expect(progress.totalBytes).toBe(1000);
      expect(reporter.chunkProgress).toHaveLength(1);
      expect(reporter.chunkProgress[0].chunkEnd).toBe(999);
    });
  });
});
