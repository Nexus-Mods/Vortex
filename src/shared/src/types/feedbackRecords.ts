import type { NexusGameId, VortexGameId } from "./ids";

// https://github.com/Nexus-Mods/flamework/tree/master/contracts/feedback
// One feedback is a set of records sharing a feedback_id, sent to the vortex-feedback service: its logs,
// state and crash summaries, an optional screenshot and screen recording, and one `feedback` record
// with the text.
export type FeedbackRecord =
  | FeedbackHeaderRecord
  | FeedbackLogRecord
  | FeedbackStateRecord
  | FeedbackCrashRecord
  | FeedbackScreenshotRecord
  | FeedbackReplayRecord;

export type FeedbackRecordType = FeedbackRecord["type"];

export type FeedbackHeaderRecord = {
  type: "feedback";
  version: 1;

  payload: FeedbackHeaderPayload;
};

export type FeedbackHeaderPayload = {
  feedback_id: string;
  text: string;
  created_at: string;
  platform: string;
  platform_version: string;
  arch: string;
  /** Vortex's own id for the active game */
  game: VortexGameId | null;
  /** the numeric Nexus Mods id of that game, when it has one */
  nexus_game_id: NexusGameId | null;
  user_path_has_non_ascii: boolean;
  /** traces exported in this session, to find the errors the user ran into */
  trace_ids: string[];
  /** how many records of each other type this feedback has */
  records: Record<Exclude<FeedbackRecordType, "feedback">, number>;
  log_window: { from: string | null; to: string | null };
};

export type FeedbackLogEntry = {
  ts: string;
  level: string;
  message: string;
};

export type FeedbackLogRecord = {
  type: "feedback_log";
  version: 1;

  payload: {
    feedback_id: string;
    file: string;
    part: number;
    entries: FeedbackLogEntry[];
  };
};

export type FeedbackStateRecord = {
  type: "feedback_state";
  version: 1;

  payload: {
    feedback_id: string;
    /**
     * the state key, dot-separated, e.g. `settings` or `persistent.mods.skyrimse`. A `.`, `#` or
     * `\` inside a key is escaped with a backslash, e.g. `persistent.mods.skyrimse.SkyUI-5\.2`.
     */
    path: string;
    /**
     * Set when the value at `path` is too large for one record: `value` then holds some of its
     * keys, and the records of the same path, numbered from 0, hold all of them between them.
     */
    part?: number;
    value: unknown;
  };
};

/** The facts read from a crash dump; every field is absent when the dump did not have it. */
export type FeedbackCrashSummary = {
  exception_code?: string;
  exception_name?: string;
  exception_address?: string;
  module?: string;
  module_version?: string;
  module_offset?: string;
  module_id?: string;
  process_type?: string;
  app_version?: string;
  fatal_message?: string;
  stack?: string[];
  stack_modules?: string[];
};

export type FeedbackCrashRecord = {
  type: "feedback_crash";
  version: 1;

  payload: {
    feedback_id: string;
    /** the dump's file name */
    file: string;
    modified_at: string;
    /** why the dump could not be read, when it could not */
    unreadable_reason: string | null;
    summary: FeedbackCrashSummary | null;
  };
};

export type FeedbackScreenshotRecord = {
  type: "feedback_screenshot";
  version: 1;

  payload: {
    feedback_id: string;
    mime: "image/jpeg";
    width: number;
    height: number;
    /** base64 */
    data: string;
  };
};

/**
 * Part of a recording of the client window for the minutes before the feedback was sent. The
 * recording is its rrweb events, oldest first, as one JSON array, gzip-compressed and then base64
 * encoded. That text is cut into parts, numbered from 0, which joined in order give it back. Every
 * text on screen is masked. A full picture of the page can be megabytes, so the recording is cut
 * as text rather than between events: no event is too large to send.
 */
export type FeedbackReplayRecord = {
  type: "feedback_replay";
  version: 1;

  payload: {
    feedback_id: string;
    part: number;
    /** how many parts the recording is in */
    parts: number;
    encoding: "gzip+base64";
    /** the recording's first and last event, the same on every part */
    starts_at: string;
    ends_at: string;
    event_count: number;
    /** this part's piece of the encoded recording */
    data: string;
  };
};
