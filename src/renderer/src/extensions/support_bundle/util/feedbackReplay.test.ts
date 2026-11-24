import type { IFeedbackReplayBatch, IFeedbackReplayEvent } from "@vortex/shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  flushFeedbackReplay,
  maskReplayEvent,
  startFeedbackReplay,
  stopFeedbackReplay,
} from "./feedbackReplay";

const { recordMock, stopRecorderMock } = vi.hoisted(() => ({
  recordMock: vi.fn(),
  stopRecorderMock: vi.fn(),
}));
vi.mock("@mixpanel/rrweb", () => ({ record: recordMock }));
vi.mock("@/util/log", () => ({ log: vi.fn() }));

const META = 4;
const FULL = 2;
const INCREMENTAL = 3;

const event = (type: number, timestamp: number, data?: unknown): IFeedbackReplayEvent => ({
  type,
  timestamp,
  data,
});

describe("maskReplayEvent", () => {
  it("masks the text in attributes and keeps what shapes the page", () => {
    const masked = maskReplayEvent(
      event(FULL, 1, {
        node: {
          type: 0,
          childNodes: [
            {
              type: 2,
              tagName: "div",
              attributes: {
                class: "mod-row",
                // Vortex builds some ids from mod names
                id: "mods--SkyUI--3863",
                title: "SkyUI 5.2",
                "data-mod": "skyui",
                style: "width: 3px",
              },
              childNodes: [
                {
                  type: 2,
                  tagName: "use",
                  attributes: {
                    id: "icon-check",
                    href: "#icon-check",
                    "aria-label": "Enabled mod",
                    "data-symbol": "check",
                  },
                  childNodes: [],
                },
              ],
            },
          ],
        },
      }),
    );

    const div = (
      masked.data as {
        node: {
          childNodes: {
            attributes: Record<string, string>;
            childNodes: { attributes: Record<string, string> }[];
          }[];
        };
      }
    ).node.childNodes[0]!;
    expect(div.attributes).toEqual({
      class: "mod-row",
      id: "*****************",
      title: "***** ***",
      "data-mod": "*****",
      style: "width: 3px",
    });
    expect(div.childNodes[0]!.attributes).toEqual({
      id: "icon-check",
      href: "#icon-check",
      "aria-label": "******* ***",
      "data-symbol": "check",
    });
  });

  it("masks attributes that are added or changed later", () => {
    const masked = maskReplayEvent(
      event(INCREMENTAL, 1, {
        source: 0,
        adds: [
          {
            parentId: 1,
            node: { type: 2, tagName: "span", attributes: { title: "abc" }, childNodes: [] },
          },
        ],
        attributes: [
          { id: 2, attributes: { placeholder: "Search mods", class: "on", hidden: null } },
        ],
        texts: [],
        removes: [],
      }),
    );

    const data = masked.data as {
      adds: { node: { attributes: Record<string, unknown> } }[];
      attributes: { attributes: Record<string, unknown> }[];
    };
    expect(data.adds[0]!.node.attributes).toEqual({ title: "***" });
    expect(data.attributes[0]!.attributes).toEqual({
      placeholder: "****** ****",
      class: "on",
      hidden: null,
    });
  });

  it("replaces the page's address, which holds the install folder", () => {
    const masked = maskReplayEvent(
      event(META, 1, {
        href: "file:///C:/Users/bob/AppData/Local/Programs/Vortex/index.html",
        width: 10,
        height: 10,
      }),
    );

    expect(masked.data).toEqual({ href: "vortex://app", width: 10, height: 10 });
  });
});

describe("startFeedbackReplay", () => {
  const feedbackApi = {
    replayBatch: vi.fn<(batch: IFeedbackReplayBatch) => void>(),
    replayReset: vi.fn<() => void>(),
  };
  let emit: (event: IFeedbackReplayEvent) => void = () => undefined;

  const batches = (): IFeedbackReplayBatch[] =>
    feedbackApi.replayBatch.mock.calls.map(([batch]) => batch);

  beforeEach(() => {
    vi.clearAllMocks();
    recordMock.mockImplementation((options: { emit: typeof emit }) => {
      emit = options.emit;
      return stopRecorderMock;
    });
    (window as unknown as { api: { feedback: typeof feedbackApi } }).api.feedback = feedbackApi;
    stopFeedbackReplay();
    vi.clearAllMocks();
  });

  it("hands main the events since the last batch, masked and redacted, as text", async () => {
    await startFeedbackReplay();
    emit(event(META, 1, { href: "file:///C:/Users/bob/Vortex/index.html" }));
    emit(event(FULL, 2, { node: { attributes: { title: "SkyUI", style: "C:/Users/bob/a.css" } } }));
    emit(event(INCREMENTAL, 3, { source: 1 }));

    flushFeedbackReplay();
    flushFeedbackReplay();

    expect(batches()).toHaveLength(1);
    expect(batches()[0]).toMatchObject({
      startsSegment: true,
      startsAt: 1,
      endsAt: 3,
      eventCount: 3,
    });
    expect(JSON.parse(`[${batches()[0]!.text}]`)).toEqual([
      event(META, 1, { href: "vortex://app" }),
      event(FULL, 2, { node: { attributes: { title: "*****", style: "C:/Users/<USER>/a.css" } } }),
      event(INCREMENTAL, 3, { source: 1 }),
    ]);
  });

  it("starts a batch at every full picture, and a segment's batches join into its events", async () => {
    await startFeedbackReplay();
    const segmentOne = [event(META, 1, {}), event(FULL, 2, {}), event(INCREMENTAL, 3, {})];
    const segmentOneMore = [event(INCREMENTAL, 4, {})];
    const segmentTwo = [event(META, 5, {}), event(FULL, 6, {})];

    segmentOne.forEach(emit);
    flushFeedbackReplay();
    // the next picture of the page hands the batch over on its own, without waiting for a flush
    [...segmentOneMore, ...segmentTwo].forEach(emit);
    flushFeedbackReplay();

    expect(batches().map((batch) => [batch.startsSegment, batch.eventCount])).toEqual([
      [true, 3],
      [false, 1],
      [true, 2],
    ]);
    // a batch that continues a segment starts with the comma that joins it on
    expect(batches()[1]!.text.startsWith(",")).toBe(true);
    const [one, oneMore, two] = batches();
    expect(JSON.parse(`[${one!.text}${oneMore!.text},${two!.text}]`)).toEqual([
      ...segmentOne,
      ...segmentOneMore,
      ...segmentTwo,
    ]);
  });

  it("starts one recorder however often it is asked to", async () => {
    await Promise.all([startFeedbackReplay(), startFeedbackReplay()]);
    await startFeedbackReplay();

    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it("stops, drops what was not handed over yet, and has main forget the rest", async () => {
    await startFeedbackReplay();
    emit(event(INCREMENTAL, 1, { source: 1 }));

    stopFeedbackReplay();
    flushFeedbackReplay();

    expect(stopRecorderMock).toHaveBeenCalled();
    expect(feedbackApi.replayReset).toHaveBeenCalledTimes(1);
    expect(feedbackApi.replayBatch).not.toHaveBeenCalled();
  });

  it("does nothing when asked to stop while not recording", () => {
    stopFeedbackReplay();

    expect(feedbackApi.replayReset).not.toHaveBeenCalled();
  });
});
