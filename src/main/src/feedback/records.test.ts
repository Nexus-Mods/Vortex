import { NexusGameId, VortexGameId, type FeedbackRecord } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import {
  buildFeedbackRecords,
  feedbackRecordKey,
  JsonSizer,
  leftOutValue,
  type IFeedbackContent,
} from "./records";

const FEEDBACK_ID = "1NG5-K8H7-QX3M-9T2B";

const content = (overrides: Partial<IFeedbackContent> = {}): IFeedbackContent => ({
  feedbackId: FEEDBACK_ID,
  text: "The mod list is empty after an update.",
  createdAt: new Date("2026-11-19T12:00:00.000Z"),
  platform: "win32",
  platformVersion: "10.0.26100",
  arch: "x64",
  userPathHasNonAscii: false,
  game: VortexGameId("skyrimse"),
  nexusGameId: NexusGameId(1704),
  traceIds: ["trace-1"],
  logs: [],
  state: undefined,
  crashes: [],
  screenshot: undefined,
  replay: undefined,
  ...overrides,
});

const ofType = <T extends FeedbackRecord["type"]>(records: FeedbackRecord[], type: T) =>
  records.filter((record): record is Extract<FeedbackRecord, { type: T }> => record.type === type);

describe("buildFeedbackRecords", () => {
  it("sends the text alone as one feedback record", async () => {
    const records = await buildFeedbackRecords(content());

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      type: "feedback",
      version: 1,
      payload: {
        feedback_id: FEEDBACK_ID,
        text: "The mod list is empty after an update.",
        created_at: "2026-11-19T12:00:00.000Z",
        platform: "win32",
        platform_version: "10.0.26100",
        arch: "x64",
        game: "skyrimse",
        nexus_game_id: 1704,
        user_path_has_non_ascii: false,
        trace_ids: ["trace-1"],
        records: {
          feedback_log: 0,
          feedback_state: 0,
          feedback_crash: 0,
          feedback_screenshot: 0,
          feedback_replay: 0,
        },
        log_window: { from: null, to: null },
      },
    });
  });

  it("puts the feedback record last, with the count of every other type", async () => {
    const records = await buildFeedbackRecords(
      content({
        logs: [
          {
            file: "vortex.log",
            entries: [
              { ts: "2026-11-19T11:10:00.000Z", level: "INFO", message: "a" },
              { ts: "2026-11-19T11:50:00.000Z", level: "WARN", message: "b" },
            ],
          },
          {
            file: "network.log",
            entries: [{ ts: "2026-11-19T11:05:00.000Z", level: "INFO", message: "c" }],
          },
          { file: "vortex1.log", entries: [] },
        ],
        state: { settings: { a: 1 }, session: { b: 2 } },
        crashes: [{ file: "one.dmp", modifiedAt: Date.parse("2026-11-19T11:00:00.000Z") }],
        screenshot: { mime: "image/jpeg", width: 4, height: 2, data: "AAAA" },
        replay: {
          data: "QUJD",
          startsAt: "2026-11-19T11:55:00.000Z",
          endsAt: "2026-11-19T12:00:00.000Z",
          eventCount: 1,
        },
      }),
    );

    const header = records.at(-1)!;
    expect(header.type).toBe("feedback");
    expect(ofType(records, "feedback")[0]!.payload.records).toEqual({
      feedback_log: 2,
      feedback_state: 2,
      feedback_crash: 1,
      feedback_screenshot: 1,
      feedback_replay: 1,
    });
    expect(ofType(records, "feedback")[0]!.payload.log_window).toEqual({
      from: "2026-11-19T11:05:00.000Z",
      to: "2026-11-19T11:50:00.000Z",
    });
    expect(records.every((record) => record.payload.feedback_id === FEEDBACK_ID)).toBe(true);
  });

  it("sends one state record per top-level key, whole", async () => {
    const records = await buildFeedbackRecords(
      content({ state: { settings: { interface: { language: "en" } }, session: [] } }),
    );

    expect(ofType(records, "feedback_state").map((record) => record.payload)).toEqual([
      { feedback_id: FEEDBACK_ID, path: "settings", value: { interface: { language: "en" } } },
      { feedback_id: FEEDBACK_ID, path: "session", value: [] },
    ]);
  });

  it("sends a state key over the limit in parts, each with as many of its keys as fit", async () => {
    const text = "x".repeat(100);
    const records = await buildFeedbackRecords(
      content({
        state: {
          settings: { small: true },
          persistent: { a: text, b: text, c: text, d: text, e: text },
        },
      }),
      300,
    );

    const state = ofType(records, "feedback_state");
    expect(state.map((record) => record.payload)).toEqual([
      { feedback_id: FEEDBACK_ID, path: "settings", value: { small: true } },
      { feedback_id: FEEDBACK_ID, path: "persistent", part: 0, value: { a: text, b: text } },
      { feedback_id: FEEDBACK_ID, path: "persistent", part: 1, value: { c: text, d: text } },
      { feedback_id: FEEDBACK_ID, path: "persistent", part: 2, value: { e: text } },
    ]);
    expect(state.map(feedbackRecordKey)).toEqual([
      "settings",
      "persistent#0",
      "persistent#1",
      "persistent#2",
    ]);
  });

  it("keeps a key named __proto__ in a part, as a plain key", async () => {
    const text = "x".repeat(100);
    const persistent = JSON.parse(`{"__proto__":"${text}","a":"${text}","b":"${text}"}`) as Record<
      string,
      unknown
    >;
    const records = await buildFeedbackRecords(content({ state: { persistent } }), 300);

    const values = ofType(records, "feedback_state").map((record) => record.payload.value);
    expect(values.map((value) => JSON.stringify(value))).toEqual([
      `{"__proto__":"${text}","a":"${text}"}`,
      `{"b":"${text}"}`,
    ]);
  });

  it("sends a key that is over the limit by itself under its own path, also in parts", async () => {
    const text = "x".repeat(100);
    const records = await buildFeedbackRecords(
      content({
        state: {
          persistent: {
            profiles: { p: 1 },
            mods: { skyrimse: { a: text, b: text, c: text }, fallout4: { d: text } },
            history: { h: 2 },
          },
        },
      }),
      300,
    );

    const state = ofType(records, "feedback_state");
    expect(state.map((record) => record.payload)).toEqual([
      // what fits stays together under the path it belongs to
      {
        feedback_id: FEEDBACK_ID,
        path: "persistent",
        part: 0,
        value: { profiles: { p: 1 }, history: { h: 2 } },
      },
      {
        feedback_id: FEEDBACK_ID,
        path: "persistent.mods",
        part: 0,
        value: { fallout4: { d: text } },
      },
      {
        feedback_id: FEEDBACK_ID,
        path: "persistent.mods.skyrimse",
        part: 0,
        value: { a: text, b: text },
      },
      { feedback_id: FEEDBACK_ID, path: "persistent.mods.skyrimse", part: 1, value: { c: text } },
    ]);
  });

  it("keeps the records of a large state few", async () => {
    const mods = Object.fromEntries(
      Array.from({ length: 2000 }, (_unused, index) => [`mod-${index}`, { name: "m".repeat(40) }]),
    );

    const state = ofType(
      await buildFeedbackRecords(
        content({ state: { persistent: { mods: { skyrimse: mods } } } }),
        20_000,
      ),
      "feedback_state",
    );

    // about 130 KB of mods under a 20 KB limit: a handful of parts, not a record per mod
    expect(state.length).toBeLessThan(10);
    expect(Object.assign({}, ...state.map((record) => record.payload.value as object))).toEqual(
      mods,
    );
  });

  it("leaves out a value over the limit that has no keys to send it by, and keeps the rest", async () => {
    const records = await buildFeedbackRecords(
      content({ state: { session: { text: "x".repeat(500), kept: 1 } } }),
      100,
    );

    expect(ofType(records, "feedback_state").map((record) => record.payload)).toEqual([
      { feedback_id: FEEDBACK_ID, path: "session", part: 0, value: { kept: 1 } },
      { feedback_id: FEEDBACK_ID, path: "session.text", value: leftOutValue(502) },
    ]);
  });

  it("sends a log file over the limit in numbered parts, losing no entry", async () => {
    const entries = Array.from({ length: 10 }, (_unused, index) => ({
      ts: `2026-11-19T11:00:0${index}.000Z`,
      level: "INFO",
      message: "m".repeat(60),
    }));

    const logs = ofType(
      await buildFeedbackRecords(content({ logs: [{ file: "vortex.log", entries }] }), 350),
      "feedback_log",
    );

    expect(logs.length).toBeGreaterThan(1);
    expect(logs.map((record) => record.payload.part)).toEqual(logs.map((_record, index) => index));
    expect(logs.flatMap((record) => record.payload.entries)).toEqual(entries);
  });

  it("keeps the start of a log entry that is over the limit by itself", async () => {
    const entries = [
      { ts: "2026-11-19T11:00:00.000Z", level: "INFO", message: "before" },
      { ts: "2026-11-19T11:00:01.000Z", level: "WARN", message: `dump ${"é".repeat(1000)}` },
      { ts: "2026-11-19T11:00:02.000Z", level: "INFO", message: "after" },
    ];

    const logs = ofType(
      await buildFeedbackRecords(content({ logs: [{ file: "vortex.log", entries }] }), 400),
      "feedback_log",
    );

    const kept = logs.flatMap((record) => record.payload.entries);
    expect(kept.map((entry) => entry.level)).toEqual(["INFO", "WARN", "INFO"]);
    expect(kept[1]!.message).toMatch(/^dump é+\n\[cut: \d+ of 1005 characters left out\]$/);
    for (const entry of kept) {
      expect(new TextEncoder().encode(JSON.stringify(entry)).length).toBeLessThanOrEqual(400);
    }
  });

  it("escapes the dots in a key, so a deeper state path splits back into its keys", async () => {
    const text = "x".repeat(200);
    const state = ofType(
      await buildFeedbackRecords(
        content({ state: { persistent: { mods: { "SkyUI-5.2#1": { a: text, b: text } } } } }),
        300,
      ),
      "feedback_state",
    );

    expect(state.map((record) => record.payload.path)).toEqual([
      "persistent.mods.SkyUI-5\\.2\\#1",
      "persistent.mods.SkyUI-5\\.2\\#1",
    ]);
  });

  it("turns a crash summary into the payload's field names", async () => {
    const records = await buildFeedbackRecords(
      content({
        crashes: [
          {
            file: "one.dmp",
            modifiedAt: Date.parse("2026-11-19T11:00:00.000Z"),
            summary: {
              exceptionCode: "0xc0000005",
              exceptionName: "ACCESS_VIOLATION",
              module: "KERNELBASE.dll",
              moduleOffset: "0x52bdc",
              processType: "renderer",
              stack: ["KERNELBASE.dll+0x52bdc"],
            },
          },
          {
            file: "two.dmp",
            modifiedAt: Date.parse("2026-11-19T10:00:00.000Z"),
            unreadableReason: "file-too-large",
          },
        ],
      }),
    );

    const crashes = ofType(records, "feedback_crash").map((record) => record.payload);
    expect(crashes[0]).toMatchObject({
      file: "one.dmp",
      modified_at: "2026-11-19T11:00:00.000Z",
      unreadable_reason: null,
      summary: {
        exception_code: "0xc0000005",
        exception_name: "ACCESS_VIOLATION",
        module: "KERNELBASE.dll",
        module_offset: "0x52bdc",
        process_type: "renderer",
        stack: ["KERNELBASE.dll+0x52bdc"],
      },
    });
    expect(crashes[1]).toMatchObject({ unreadable_reason: "file-too-large", summary: null });
  });
});

describe("feedbackRecordKey", () => {
  it("tells apart the records of one type", async () => {
    const records = await buildFeedbackRecords(
      content({
        logs: [
          {
            file: "vortex.log",
            entries: [{ ts: "2026-11-19T11:00:00.000Z", level: "INFO", message: "a" }],
          },
        ],
        state: { settings: {} },
        crashes: [{ file: "one.dmp", modifiedAt: 0 }],
        screenshot: { mime: "image/jpeg", width: 1, height: 1, data: "" },
      }),
    );

    expect(records.map(feedbackRecordKey)).toEqual(["vortex.log#0", "settings", "one.dmp", "", ""]);
  });
});

/** A packed recording holding `data`. */
const packed = (data: string) => ({
  data,
  startsAt: "2026-11-19T11:55:00.000Z",
  endsAt: "2026-11-19T12:00:00.000Z",
  eventCount: 42,
});

describe("buildFeedbackRecords with a screen recording", () => {
  it("cuts the packed recording into numbered parts under the record limit, in order", async () => {
    const data = "QUJD".repeat(100);
    const records = await buildFeedbackRecords(content({ replay: packed(data) }), 400);
    const parts = ofType(records, "feedback_replay");

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((record) => record.payload.part)).toEqual(
      parts.map((_record, index) => index),
    );
    expect(parts.map((record) => record.payload.data).join("")).toBe(data);
    expect(parts.map(feedbackRecordKey)).toEqual(parts.map((_record, index) => String(index)));
    for (const record of parts) {
      expect(record.payload).toMatchObject({
        parts: parts.length,
        encoding: "gzip+base64",
        starts_at: "2026-11-19T11:55:00.000Z",
        ends_at: "2026-11-19T12:00:00.000Z",
        event_count: 42,
      });
      expect(new TextEncoder().encode(JSON.stringify(record.payload)).length).toBeLessThanOrEqual(
        400,
      );
    }
    expect(ofType(records, "feedback")[0]!.payload.records.feedback_replay).toBe(parts.length);
  });

  it("sends a small recording as one part", async () => {
    const parts = ofType(
      await buildFeedbackRecords(content({ replay: packed("QUJD") })),
      "feedback_replay",
    );

    expect(parts.map((record) => record.payload)).toEqual([
      {
        feedback_id: FEEDBACK_ID,
        part: 0,
        parts: 1,
        encoding: "gzip+base64",
        starts_at: "2026-11-19T11:55:00.000Z",
        ends_at: "2026-11-19T12:00:00.000Z",
        event_count: 42,
        data: "QUJD",
      },
    ]);
  });
});

describe("JsonSizer", () => {
  it("sizes a value as JSON.stringify writes it, in bytes", () => {
    const shared = { name: "shared" };
    const values: unknown[] = [
      null,
      true,
      0,
      -1.5e-7,
      Number.NaN,
      "",
      'quote " backslash \\ newline \n tab \t control \u0001',
      "ünïcødé ✓ 🎮",
      [],
      {},
      [undefined, () => 1, Symbol("s"), 1],
      { kept: 1, gone: undefined, fn: () => 1, sym: Symbol("s"), 'key.with"quote': "v" },
      { when: new Date("2026-11-19T12:00:00.000Z"), nested: { list: [shared, shared, { a: [] }] } },
      { shared, again: shared },
    ];
    for (const value of values) {
      expect(new JsonSizer().size(value)).toBe(Buffer.byteLength(JSON.stringify(value) ?? ""));
    }
  });
});
