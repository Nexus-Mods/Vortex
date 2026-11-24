import { setImmediate as yieldToLoop } from "node:timers/promises";

import type {
  FeedbackCrashRecord,
  FeedbackCrashSummary,
  FeedbackHeaderRecord,
  FeedbackLogEntry,
  FeedbackLogRecord,
  FeedbackRecord,
  FeedbackReplayRecord,
  FeedbackScreenshotRecord,
  FeedbackStateRecord,
  NexusGameId,
  VortexGameId,
} from "@vortex/shared";
import type { IFeedbackCrashDump, IFeedbackScreenshot } from "@vortex/shared/ipc";

import type { IPackedReplay } from "./packReplay";

/**
 * The largest payload a record is built with. The service takes a record of 4 MiB, which is what
 * a request costs it in memory, so a record has to fit under that with room for the fields around
 * its data.
 */
export const MAX_RECORD_BYTES = 3.5 * 1024 * 1024;

export interface IFeedbackLogFile {
  file: string;
  entries: FeedbackLogEntry[];
}

/** Everything one feedback holds, gathered and redacted, before it is cut into records. */
export interface IFeedbackContent {
  feedbackId: string;
  text: string;
  createdAt: Date;
  platform: string;
  platformVersion: string;
  arch: string;
  userPathHasNonAscii: boolean;
  game: VortexGameId | null;
  nexusGameId: NexusGameId | null;
  traceIds: string[];
  logs: IFeedbackLogFile[];
  /** The state export by top-level key; absent when the user sends the text alone. */
  state: Record<string, unknown> | undefined;
  crashes: IFeedbackCrashDump[];
  screenshot: IFeedbackScreenshot | undefined;
  /** The screen recording, masked, redacted and packed; absent when the user leaves it out. */
  replay: IPackedReplay | undefined;
}

/**
 * What a state value over the record limit with no keys to send it by is sent as, such as a long
 * array. The rest of the state still goes, rather than the whole feedback failing over one value.
 */
export const leftOutValue = (bytes: number): string =>
  `[left out: ${bytes} bytes, too large for one record]`;

/** The bytes of a value as JSON, for a value of no more than a few fields, such as a log entry. */
const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value) ?? "");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Whether JSON keeps a value as a field: it drops undefined, functions and symbols. */
const isJsonValue = (value: unknown): boolean =>
  value !== undefined && typeof value !== "function" && typeof value !== "symbol";

/**
 * Sizes state values as JSON, each object and array once however often it is asked about.
 * Splitting a hive asks for the size of the hive, then of every child, then of their children, as
 * deep as it goes; stringifying each of those again would serialise a hive of tens of megabytes
 * once per level. The sizes match `JSON.stringify`, which a test holds this to.
 */
export class JsonSizer {
  readonly #sizes = new WeakMap<object, number>();

  public size(value: unknown): number {
    if (typeof value !== "object" || value === null) return jsonBytes(value);
    const known = this.#sizes.get(value);
    if (known !== undefined) return known;

    let size: number;
    if (Array.isArray(value)) {
      // brackets and commas; an element JSON cannot hold is written as null
      size = 2 + Math.max(0, value.length - 1);
      for (const element of value) {
        size += isJsonValue(element) ? this.size(element) : 4;
      }
    } else if (isPlainObject(value)) {
      size = 2;
      let fields = 0;
      for (const [key, child] of Object.entries(value)) {
        if (!isJsonValue(child)) continue;
        // the key, its colon and, after the first field, a comma
        size += jsonBytes(key) + 1 + this.size(child) + (fields > 0 ? 1 : 0);
        fields++;
      }
    } else {
      // a Date, a Map and the like: whatever JSON.stringify makes of them
      size = jsonBytes(value);
    }
    this.#sizes.set(value, size);
    return size;
  }
}

/**
 * What tells two records of one type and one feedback apart. With the type and the feedback it
 * gives the record's id, so it has to be the same every time the same feedback is built.
 */
export function feedbackRecordKey(record: FeedbackRecord): string {
  switch (record.type) {
    case "feedback_log":
      return `${record.payload.file}#${record.payload.part}`;
    case "feedback_state":
      return record.payload.part === undefined
        ? record.payload.path
        : `${record.payload.path}#${record.payload.part}`;
    case "feedback_crash":
      return record.payload.file;
    case "feedback_replay":
      return String(record.payload.part);
    default:
      return "";
  }
}

/**
 * An entry that fits a record by itself. One over the limit, such as a line that dumped a whole
 * object, keeps the start of its message: the service refuses a record over its limit, and with it
 * the whole feedback.
 */
function fitEntry(entry: FeedbackLogEntry, maxBytes: number): FeedbackLogEntry {
  const size = jsonBytes(entry);
  if (size <= maxBytes) return entry;

  const { message } = entry;
  // a first guess from the share that fits, then shorter until it does: escaping and characters
  // of more than one byte make the bytes of a cut hard to know beforehand
  let length = Math.floor(message.length * (maxBytes / size));
  for (;;) {
    const cut: FeedbackLogEntry = {
      ...entry,
      message: `${message.slice(0, length)}\n[cut: ${message.length - length} of ${message.length} characters left out]`,
    };
    if (jsonBytes(cut) <= maxBytes || length === 0) return cut;
    length = Math.floor(length * 0.9);
  }
}

/**
 * One record per log file, or several when a file's entries are over the record limit. Each entry
 * is an object of its own, so a row reads and searches in ClickHouse without unpacking.
 */
function logRecords(
  feedbackId: string,
  logs: readonly IFeedbackLogFile[],
  maxBytes: number,
): FeedbackLogRecord[] {
  const records: FeedbackLogRecord[] = [];
  for (const { file, entries } of logs) {
    if (entries.length === 0) continue;

    let part: FeedbackLogEntry[] = [];
    let used = 0;
    let index = 0;
    const flush = (): void => {
      records.push({
        type: "feedback_log",
        version: 1,
        payload: { feedback_id: feedbackId, file, part: index++, entries: part },
      });
      part = [];
      used = 0;
    };
    for (const original of entries) {
      const entry = fitEntry(original, maxBytes);
      // the comma before an entry counts too, which keeps the total on the safe side
      const size = jsonBytes(entry) + 1;
      if (part.length > 0 && used + size > maxBytes) flush();
      part.push(entry);
      used += size;
    }
    flush();
  }
  return records;
}

/**
 * A key as one step of a state path. Mod ids often hold dots, so a dot, the `#` that numbers a
 * record's parts and the backslash itself are escaped with a backslash, and a path splits back into
 * its keys at every dot that is not escaped.
 */
export const escapeStatePathKey = (key: string): string => key.replace(/[\\.#]/g, "\\$&");

/** A part's keys, without a prototype, so a key named `__proto__` is kept like any other. */
const newPart = (): Record<string, unknown> => Object.create(null) as Record<string, unknown>;

/**
 * One record per state key. A value over the record limit is sent in parts instead: each part
 * holds as many of the value's keys as fit, so the parts of a path are few and put together again
 * by merging their values. A key that is over the limit by itself is sent the same way under its
 * own path, as deep as it takes. A value with no keys that is over the limit
 * by itself is left out (`leftOutValue`); every other record holds complete values.
 */
function stateRecords(
  feedbackId: string,
  path: string,
  value: unknown,
  maxBytes: number,
  sizer: JsonSizer,
): FeedbackStateRecord[] {
  if (value === undefined) return [];

  const bytes = sizer.size(value);
  if (bytes <= maxBytes) {
    return [
      { type: "feedback_state", version: 1, payload: { feedback_id: feedbackId, path, value } },
    ];
  }
  if (!isPlainObject(value)) {
    return [
      {
        type: "feedback_state",
        version: 1,
        payload: { feedback_id: feedbackId, path, value: leftOutValue(bytes) },
      },
    ];
  }

  const parts: FeedbackStateRecord[] = [];
  const deeper: FeedbackStateRecord[] = [];
  let part = newPart();
  let used = 0;
  const flush = (): void => {
    if (Object.keys(part).length === 0) return;
    parts.push({
      type: "feedback_state",
      version: 1,
      payload: { feedback_id: feedbackId, path, part: parts.length, value: part },
    });
    part = newPart();
    used = 0;
  };
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    // the key, its colon and a comma count too, which keeps the total on the safe side
    const size = jsonBytes(key) + sizer.size(child) + 2;
    if (size > maxBytes) {
      deeper.push(
        ...stateRecords(feedbackId, `${path}.${escapeStatePathKey(key)}`, child, maxBytes, sizer),
      );
      continue;
    }
    if (used + size > maxBytes) flush();
    part[key] = child;
    used += size;
  }
  flush();
  return [...parts, ...deeper];
}

function crashSummary(summary: IFeedbackCrashDump["summary"]): FeedbackCrashSummary | null {
  if (summary === undefined) return null;
  return {
    exception_code: summary.exceptionCode,
    exception_name: summary.exceptionName,
    exception_address: summary.exceptionAddress,
    module: summary.module,
    module_version: summary.moduleVersion,
    module_offset: summary.moduleOffset,
    module_id: summary.moduleId,
    process_type: summary.processType,
    app_version: summary.appVersion,
    fatal_message: summary.fatalMessage,
    stack: summary.stack,
    stack_modules: summary.stackModules,
  };
}

function crashRecords(
  feedbackId: string,
  crashes: readonly IFeedbackCrashDump[],
): FeedbackCrashRecord[] {
  return crashes.map((crash) => ({
    type: "feedback_crash",
    version: 1,
    payload: {
      feedback_id: feedbackId,
      file: crash.file,
      modified_at: new Date(crash.modifiedAt).toISOString(),
      unreadable_reason: crash.unreadableReason ?? null,
      summary: crashSummary(crash.summary),
    },
  }));
}

/**
 * The packed recording cut into parts under the record limit, in order. It is cut as text, which
 * base64 lets fall anywhere, so even a full picture of the page larger than a record is sent.
 */
function replayRecords(
  feedbackId: string,
  replay: IPackedReplay | undefined,
  maxBytes: number,
): FeedbackReplayRecord[] {
  if (replay === undefined || replay.data.length === 0) return [];

  const payload = (part: number, parts: number, data: string): FeedbackReplayRecord["payload"] => ({
    feedback_id: feedbackId,
    part,
    parts,
    encoding: "gzip+base64",
    starts_at: replay.startsAt,
    ends_at: replay.endsAt,
    event_count: replay.eventCount,
    data,
  });
  // base64 needs no escaping in JSON, so a part's size is its fields plus its piece of the text
  const room = maxBytes - jsonBytes(payload(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, ""));
  if (room <= 0) return [];

  const parts = Math.ceil(replay.data.length / room);
  return Array.from({ length: parts }, (_unused, part) => ({
    type: "feedback_replay",
    version: 1,
    payload: payload(part, parts, replay.data.slice(part * room, (part + 1) * room)),
  }));
}

function logWindow(logs: readonly IFeedbackLogFile[]): { from: string | null; to: string | null } {
  let from: string | null = null;
  let to: string | null = null;
  for (const { entries } of logs) {
    for (const { ts } of entries) {
      // ISO timestamps in UTC compare as text
      if (from === null || ts < from) from = ts;
      if (to === null || ts > to) to = ts;
    }
  }
  return { from, to };
}

/**
 * Cuts a feedback into the records the API stores. The `feedback` record comes last: it carries
 * the count of every other type, and its arrival is what marks the feedback as complete. This runs
 * in main, so the event loop gets a turn between state hives, as it does while they are exported.
 */
export async function buildFeedbackRecords(
  content: IFeedbackContent,
  maxRecordBytes: number = MAX_RECORD_BYTES,
): Promise<FeedbackRecord[]> {
  const { feedbackId } = content;

  const logs = logRecords(feedbackId, content.logs, maxRecordBytes);
  await yieldToLoop();
  const sizer = new JsonSizer();
  const state: FeedbackStateRecord[] = [];
  for (const [hive, value] of Object.entries(content.state ?? {})) {
    state.push(...stateRecords(feedbackId, hive, value, maxRecordBytes, sizer));
    await yieldToLoop();
  }
  const crashes = crashRecords(feedbackId, content.crashes);
  const screenshots: FeedbackScreenshotRecord[] =
    content.screenshot === undefined
      ? []
      : [
          {
            type: "feedback_screenshot",
            version: 1,
            payload: { feedback_id: feedbackId, ...content.screenshot },
          },
        ];

  const replay = replayRecords(feedbackId, content.replay, maxRecordBytes);

  const header: FeedbackHeaderRecord = {
    type: "feedback",
    version: 1,
    payload: {
      feedback_id: feedbackId,
      text: content.text,
      created_at: content.createdAt.toISOString(),
      platform: content.platform,
      platform_version: content.platformVersion,
      arch: content.arch,
      game: content.game,
      nexus_game_id: content.nexusGameId,
      user_path_has_non_ascii: content.userPathHasNonAscii,
      trace_ids: content.traceIds,
      records: {
        feedback_log: logs.length,
        feedback_state: state.length,
        feedback_crash: crashes.length,
        feedback_screenshot: screenshots.length,
        feedback_replay: replay.length,
      },
      log_window: logWindow(content.logs),
    },
  };

  return [...logs, ...state, ...crashes, ...screenshots, ...replay, header];
}
