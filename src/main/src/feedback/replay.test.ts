import { gunzipSync, gzipSync } from "node:zlib";

import { REPLAY_WINDOW_MS } from "@vortex/shared";
import type { IFeedbackReplayBatch, IFeedbackReplayEvent } from "@vortex/shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addReplayBatch,
  freezeReplay,
  frozenReplay,
  ReplayBuffer,
  resetReplay,
  type IReplayChunk,
  type ReplaySegment,
} from "./replay";

vi.mock("../logging", () => ({ log: vi.fn<() => void>() }));

const META = 4;
const FULL = 2;
const INCREMENTAL = 3;
const MINUTE = 60_000;

const event = (type: number, timestamp: number): IFeedbackReplayEvent => ({ type, timestamp });

/** A chunk of events, compressed as the renderer hands it over. */
const chunkOf = (
  events: readonly IFeedbackReplayEvent[],
  startsSegment: boolean,
): IReplayChunk => ({
  data: gzipSync((startsSegment ? "" : ",") + events.map((each) => JSON.stringify(each)).join(",")),
  startsSegment,
  startsAt: events[0]!.timestamp,
  endsAt: events.at(-1)!.timestamp,
  eventCount: events.length,
});

/**
 * One segment as chunks: the page's picture at `start` in a chunk of its own, then a chunk with a
 * change every minute until `end`.
 */
const segment = (start: number, end: number): IReplayChunk[] => {
  const chunks = [chunkOf([event(META, start), event(FULL, start)], true)];
  for (let at = start + MINUTE; at < end; at += MINUTE) {
    chunks.push(chunkOf([event(INCREMENTAL, at)], false));
  }
  return chunks;
};

const fill = (buffer: ReplayBuffer, chunks: IReplayChunk[]): void => {
  for (const each of chunks) buffer.add(each);
};

const startOf = (segments: ReplaySegment[]): number | undefined => segments[0]?.[0]?.startsAt;

/** A chunk of 20 MiB, for the bound on what main keeps. */
const big = (startsAt: number, startsSegment: boolean): IReplayChunk => ({
  data: new Uint8Array(20 * 1024 * 1024),
  startsSegment,
  startsAt,
  endsAt: startsAt,
  eventCount: 1,
});

describe("ReplayBuffer", () => {
  it("hands over every segment that reaches the window back, starting at a full picture", () => {
    const buffer = new ReplayBuffer();
    fill(buffer, segment(0, 2.5 * MINUTE));
    fill(buffer, segment(2.5 * MINUTE, 5 * MINUTE));
    fill(buffer, segment(5 * MINUTE, 7.5 * MINUTE));
    fill(buffer, segment(7.5 * MINUTE, 9 * MINUTE));

    const taken = buffer.take(9 * MINUTE);

    // the window starts at minute 4, so the segment from 2.5 is the first needed
    expect(startOf(taken)).toBe(2.5 * MINUTE);
    expect(taken[0]![0]!.startsSegment).toBe(true);
    expect(taken.at(-1)!.at(-1)!.endsAt).toBe(8.5 * MINUTE);
    expect(startOf(taken)).toBeLessThanOrEqual(9 * MINUTE - REPLAY_WINDOW_MS);
  });

  it("drops the oldest segments as new ones start", () => {
    const buffer = new ReplayBuffer();
    for (let i = 0; i < 10; i += 1) {
      fill(buffer, segment(i * 2.5 * MINUTE, (i + 1) * 2.5 * MINUTE));
    }

    // everything older than the kept segments is gone, even when asked for from long ago
    expect(startOf(buffer.take(0))).toBe(7 * 2.5 * MINUTE);
  });

  it("drops the oldest segments once the chunks are over the size kept, but never the last", () => {
    const buffer = new ReplayBuffer();

    buffer.add(big(0, true));
    buffer.add(big(1, true));
    buffer.add(big(2, false));

    // 60 MiB is over the bound: the first segment goes, the one being recorded stays whole
    const taken = buffer.take(0);
    expect(taken).toHaveLength(1);
    expect(taken[0]!.map((chunk) => chunk.startsAt)).toEqual([1, 2]);
  });

  it("keeps no chunk of a segment whose start it never saw", () => {
    const buffer = new ReplayBuffer();
    buffer.add(chunkOf([event(INCREMENTAL, 1)], false));

    expect(buffer.take(1)).toEqual([]);
  });

  it("hands over nothing before anything was recorded", () => {
    expect(new ReplayBuffer().take(0)).toEqual([]);
  });
});

/** A batch of events, as the renderer hands it over. */
const batchOf = (
  events: readonly IFeedbackReplayEvent[],
  startsSegment: boolean,
): IFeedbackReplayBatch => ({
  text: (startsSegment ? "" : ",") + events.map((each) => JSON.stringify(each)).join(","),
  startsSegment,
  startsAt: events[0]!.timestamp,
  endsAt: events.at(-1)!.timestamp,
  eventCount: events.length,
});

const segmentBatches = (start: number, end: number): IFeedbackReplayBatch[] => {
  const batches = [batchOf([event(META, start), event(FULL, start)], true)];
  for (let at = start + MINUTE; at < end; at += MINUTE) {
    batches.push(batchOf([event(INCREMENTAL, at)], false));
  }
  return batches;
};

describe("freezeReplay", () => {
  beforeEach(() => {
    resetReplay();
  });

  it("puts the recording so far aside, compressed, unchanged by what is recorded after", async () => {
    for (const each of segmentBatches(0, 2 * MINUTE)) void addReplayBatch(each);

    expect(await freezeReplay(2 * MINUTE)).toEqual({ startsAt: 0, endsAt: MINUTE, eventCount: 3 });

    await addReplayBatch(batchOf([event(INCREMENTAL, 3 * MINUTE)], false));
    const kept = frozenReplay()!.flat();
    expect(kept).toHaveLength(2);
    // each batch is kept as one gzip stream of its text
    expect(gunzipSync(kept[0]!.data).toString("utf8")).toBe(segmentBatches(0, 2 * MINUTE)[0]!.text);
  });

  it("keeps batches in the order they came, however long each takes to compress", async () => {
    const large = batchOf(
      [event(META, 1), { type: FULL, timestamp: 2, data: { text: "x".repeat(4_000_000) } }],
      true,
    );
    void addReplayBatch(large);
    void addReplayBatch(batchOf([event(INCREMENTAL, 3)], false));

    await freezeReplay(3);

    expect(
      frozenReplay()!
        .flat()
        .map((chunk) => chunk.startsAt),
    ).toEqual([1, 3]);
  });

  it("skips a batch that fails to compress behind a slower one, and keeps the ones after", async () => {
    const unhandled = vi.fn<(reason: unknown) => void>();
    process.on("unhandledRejection", unhandled);
    try {
      const large = batchOf(
        [event(META, 1), { type: FULL, timestamp: 2, data: { text: "x".repeat(4_000_000) } }],
        true,
      );
      void addReplayBatch(large);
      // not text, so compressing it fails at once, while the batch before is still compressing
      void addReplayBatch({ ...batchOf([event(INCREMENTAL, 3)], false), text: 42 as never });
      await addReplayBatch(batchOf([event(INCREMENTAL, 4)], false));
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).not.toHaveBeenCalled();
      await freezeReplay(4);
      expect(
        frozenReplay()!
          .flat()
          .map((chunk) => chunk.startsAt),
      ).toEqual([1, 4]);
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("puts nothing aside when nothing was recorded", async () => {
    expect(await freezeReplay()).toBeNull();
    expect(frozenReplay()).toBeUndefined();
  });

  it("forgets the recording, and a batch still being compressed, once recording stops", async () => {
    for (const each of segmentBatches(0, MINUTE)) await addReplayBatch(each);
    await freezeReplay(MINUTE);
    const late = addReplayBatch(batchOf([event(META, 2 * MINUTE)], true));

    resetReplay();
    await late;

    expect(frozenReplay()).toBeUndefined();
    expect(await freezeReplay(3 * MINUTE)).toBeNull();
  });
});
