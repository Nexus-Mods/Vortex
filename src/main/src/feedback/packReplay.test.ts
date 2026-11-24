import { gunzipSync, gzipSync } from "node:zlib";

import type { IFeedbackReplayEvent } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { packReplay } from "./packReplay";
import type { IReplayChunk } from "./replay";

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

const at = (iso: string): number => Date.parse(iso);

const first: IFeedbackReplayEvent[] = [
  { type: 4, timestamp: at("2026-11-19T11:55:00.000Z"), data: { href: "vortex://app" } },
  { type: 2, timestamp: at("2026-11-19T11:55:00.010Z"), data: { node: { id: 1 } } },
];
const firstMore: IFeedbackReplayEvent[] = [
  { type: 3, timestamp: at("2026-11-19T11:56:00.000Z"), data: { source: 2 } },
  { type: 3, timestamp: at("2026-11-19T11:56:00.500Z"), data: { source: 1 } },
];
const second: IFeedbackReplayEvent[] = [
  { type: 4, timestamp: at("2026-11-19T11:57:30.000Z"), data: { href: "vortex://app" } },
  { type: 2, timestamp: at("2026-11-19T11:57:30.010Z"), data: { node: { id: 1 } } },
  { type: 3, timestamp: at("2026-11-19T12:00:00.000Z"), data: { source: 2 } },
];

/** As the feedback views decode it: one gzip stream, then the JSON. */
const unpack = (data: string): unknown =>
  JSON.parse(gunzipSync(Buffer.from(data, "base64")).toString("utf8"));

/**
 * Whether the packed data is one gzip stream. The browser's `DecompressionStream` reads no more
 * than one; Node reads every stream in a row, so this asks the format itself: a stream ends with
 * the size of what it holds, which for one stream is the size of the whole text.
 */
const isOneStream = (data: string): boolean => {
  const bytes = Buffer.from(data, "base64");
  return bytes.readUInt32LE(bytes.length - 4) === gunzipSync(bytes).length;
};

describe("packReplay", () => {
  it("joins the chunks of every segment into one array of the events, in order", async () => {
    const packed = await packReplay([
      [chunkOf(first, true), chunkOf(firstMore, false)],
      [chunkOf(second, true)],
    ]);

    expect(unpack(packed!.data)).toEqual([...first, ...firstMore, ...second]);
    expect(packed).toMatchObject({
      startsAt: "2026-11-19T11:55:00.000Z",
      endsAt: "2026-11-19T12:00:00.000Z",
      eventCount: 7,
    });
  });

  it("sends the recording as one gzip stream, however many chunks it was kept as", async () => {
    const packed = await packReplay([
      [chunkOf(first, true), chunkOf(firstMore, false)],
      [chunkOf(second, true)],
    ]);

    expect(isOneStream(packed!.data)).toBe(true);
  });

  it("packs one segment of one chunk", async () => {
    expect(unpack((await packReplay([[chunkOf(first, true)]]))!.data)).toEqual(first);
  });

  it("packs nothing from an empty recording", async () => {
    expect(await packReplay([])).toBeUndefined();
    expect(await packReplay([[]])).toBeUndefined();
  });
});
