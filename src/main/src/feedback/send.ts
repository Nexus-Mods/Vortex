import { setTimeout } from "node:timers/promises";

import { getErrorMessageOrDefault, type FeedbackRecord } from "@vortex/shared";
import type { FeedbackSendFailure } from "@vortex/shared/ipc";

import { feedbackRecordId } from "./recordIds";
import { feedbackRecordKey } from "./records";
import { FeedbackHttpError, type IFeedbackRecordEntry, type IFeedbackSender } from "./service";

/**
 * The service takes a request body of 8 MiB as received. Bodies are sent compressed, but a
 * screenshot hardly compresses, so requests are kept under that size before compression too. A
 * feedback with more than this goes out as several requests, one after another.
 */
export const MAX_REQUEST_BYTES = 7 * 1024 * 1024;

/** Well under the service's limit on the records of one request. */
export const MAX_REQUEST_RECORDS = 500;

/** Waits before each retry of a request the service could not take. */
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

/** The send was stopped: the dialog was closed, or the user canceled. */
export class FeedbackCanceled extends Error {
  constructor() {
    super("Sending the feedback was canceled.");
    this.name = "FeedbackCanceled";
  }
}

export class FeedbackSendError extends Error {
  constructor(
    public readonly reason: FeedbackSendFailure,
    cause: unknown,
  ) {
    super(getErrorMessageOrDefault(cause), { cause });
    this.name = "FeedbackSendError";
  }
}

export interface ISendFeedbackOptions {
  /** Requests sent so far, of how many. */
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
  /** Replaced in tests, so retries don't wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  maxRequestBytes?: number;
  /**
   * How many requests an earlier attempt at the same records already sent, which are not sent
   * again. The requests are cut the same way every time, so this picks up where it stopped.
   */
  startAt?: number;
}

const encoder = new TextEncoder();
const payloadBytes = (record: FeedbackRecord): number =>
  encoder.encode(JSON.stringify(record.payload)).length;

/**
 * Groups records, in order, into requests within the service's limits. The order is kept, so the
 * `feedback` record, which the builder puts last, is in the final request.
 */
export function toFeedbackRequests(
  records: readonly FeedbackRecord[],
  maxBytes: number = MAX_REQUEST_BYTES,
): FeedbackRecord[][] {
  const requests: FeedbackRecord[][] = [];
  let used = 0;
  for (const record of records) {
    const size = payloadBytes(record);
    const current = requests.at(-1);
    if (current === undefined || used + size > maxBytes || current.length >= MAX_REQUEST_RECORDS) {
      requests.push([record]);
      used = size;
    } else {
      current.push(record);
      used += size;
    }
  }
  return requests;
}

/**
 * What a failed request means. Only a failure that may pass is retried: no answer, a timeout, or a
 * server error. Any other 4xx is the request itself, such as a wrong address, and would only fail
 * again, so it is not reported as a connection problem.
 */
function failureFor(err: unknown): Exclude<FeedbackSendFailure, "unknown"> | "retry" {
  if (!(err instanceof FeedbackHttpError)) return "retry";
  if (err.status === 401 || err.status === 403) return "unauthorized";
  if (err.status === 429) return "rate_limited";
  if (err.status === 408) return "retry";
  if (err.status >= 400 && err.status < 500) return "refused";
  return "retry";
}

/** Waits `ms`, or less when the signal is aborted first. */
const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  setTimeout(ms, undefined, { signal }).catch(() => undefined);

/**
 * Sends a feedback's records, one request after another. A request the service could not take
 * is retried, since a record keeps its id and is stored once however often it is sent. Resolves
 * when the service has stored every record; rejects with `FeedbackSendError`, or `FeedbackCanceled`
 * as soon as the signal is aborted, even in the middle of a request or a wait. The exception is
 * the final request, which holds the `feedback` record: once it is out it is let finish, since the
 * service may already have stored it, and the send resolves if it was.
 */
export async function sendFeedback(
  sender: IFeedbackSender,
  feedbackId: string,
  createdAt: Date,
  records: readonly FeedbackRecord[],
  options: ISendFeedbackOptions = {},
): Promise<void> {
  const { onProgress, signal, sleep = wait, maxRequestBytes, startAt = 0 } = options;
  const occurredAt = createdAt.toISOString();
  const requests = toFeedbackRequests(records, maxRequestBytes);
  const checkCanceled = () => {
    if (signal?.aborted === true) throw new FeedbackCanceled();
  };

  onProgress?.(Math.min(startAt, requests.length), requests.length);
  for (const [index, request] of requests.entries()) {
    if (index < startAt) continue;
    const entries: IFeedbackRecordEntry[] = request.map((record) => {
      const key = feedbackRecordKey(record);
      return { id: feedbackRecordId(feedbackId, record.type, key), occurredAt, key, record };
    });

    const finishOnCancel = index === requests.length - 1;
    for (let attempt = 0; ; attempt++) {
      checkCanceled();
      try {
        await sender.send(entries, { finishOnCancel });
        break;
      } catch (err) {
        // an aborted request rejects too, which is no failure of the service's
        checkCanceled();
        const failure = failureFor(err);
        if (failure !== "retry") throw new FeedbackSendError(failure, err);

        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) throw new FeedbackSendError("unavailable", err);
        await sleep(delay, signal);
      }
    }
    onProgress?.(index + 1, requests.length);
  }
}
