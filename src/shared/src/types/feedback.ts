import type { LogWindowMinutes } from "../feedback";
import type { NexusGameId, VortexGameId } from "./ids";

/**
 * What main reads from one crash dump for a user's feedback. The fields are the dump parser's;
 * each is absent when the dump did not have it.
 */
export interface IFeedbackCrashSummary {
  exceptionCode?: string;
  exceptionName?: string;
  exceptionAddress?: string;
  module?: string;
  moduleVersion?: string;
  moduleOffset?: string;
  moduleId?: string;
  processType?: string;
  appVersion?: string;
  fatalMessage?: string;
  stack?: string[];
  stackModules?: string[];
}

/** One of the newest crash dumps on disk, summarised. The dump itself never leaves main. */
export interface IFeedbackCrashDump {
  /** the dump's file name */
  file: string;
  modifiedAt: number;
  summary?: IFeedbackCrashSummary;
  /** why the dump could not be read, when it could not */
  unreadableReason?: string;
}

/** A capture of the window that asked for it, as a JPEG. */
export interface IFeedbackScreenshot {
  mime: "image/jpeg";
  width: number;
  height: number;
  /** base64 */
  data: string;
}

/** One event of the window recording, as the recorder emits it, with its text already masked. */
export interface IFeedbackReplayEvent {
  type: number;
  timestamp: number;
  data?: unknown;
}

/**
 * A few seconds of the window recording as the renderer hands it to main: its events masked and
 * redacted, as JSON separated by commas, without the brackets of an array, so a segment's batches
 * one after another give its events as one text. Text crosses to main for little more than the
 * cost of copying it; main compresses it on zlib's own threads and keeps it compressed.
 */
export interface IFeedbackReplayBatch {
  text: string;
  /**
   * Whether the batch starts a segment: its first event is the recorder's meta event, which comes
   * before every full picture of the page. A batch that continues a segment starts with a comma.
   */
  startsSegment: boolean;
  /** Unix times in milliseconds of its first and last event */
  startsAt: number;
  endsAt: number;
  eventCount: number;
}

/** The recording main put aside as the feedback dialog was asked for. */
export interface IFeedbackReplayInfo {
  /** Unix times in milliseconds of its first and last event */
  startsAt: number;
  endsAt: number;
  eventCount: number;
}

/** What only the renderer knows about one feedback; main gathers everything else. */
export interface IFeedbackSendRequest {
  feedbackId: string;
  /** Unix time in milliseconds the dialog was opened at; the logs end there */
  createdAt: number;
  text: string;
  game: VortexGameId | null;
  nexusGameId: NexusGameId | null;
  /** the anonymous install id, left out before one is assigned */
  instanceId: string | undefined;
  /** logs, state and crash summaries; absent when the user sends the text alone */
  supportData: IFeedbackSupportData | undefined;
  screenshot: IFeedbackScreenshot | undefined;
  /** whether the recording put aside as the dialog opened goes too */
  includeReplay: boolean;
}

export interface IFeedbackSupportData {
  /** how far back the logs go */
  logWindowMinutes: LogWindowMinutes;
  /**
   * The scrubbed `session` hive as JSON text, not yet redacted, or undefined where it could not be
   * written out. The hives main persists it reads itself, so only this one crosses.
   */
  session: string | undefined;
}

export type FeedbackSendFailure =
  /** the login was refused */
  | "unauthorized"
  /** the user has sent too much feedback for now */
  | "rate_limited"
  /** the service refuses these records, and would again */
  | "refused"
  /** the service or the network stayed down through every retry */
  | "unavailable"
  | "unknown";

/** How a send ended. A failed send is reported here and never thrown, since IPC drops error types. */
export type FeedbackSendResult =
  | { status: "sent" }
  | { status: "canceled" }
  | { status: "failed"; reason: FeedbackSendFailure; message: string };

/** Requests sent so far, of how many. */
export interface IFeedbackSendProgress {
  sent: number;
  total: number;
}
