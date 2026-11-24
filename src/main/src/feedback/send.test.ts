import type { FeedbackRecord } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackRecordId } from "./recordIds";
import { FeedbackCanceled, FeedbackSendError, sendFeedback, toFeedbackRequests } from "./send";
import {
  FeedbackHttpError,
  type IFeedbackRecordEntry,
  type IFeedbackSendCallOptions,
} from "./service";

const FEEDBACK_ID = "1NG5-K8H7-QX3M-9T2B";
const CREATED_AT = new Date("2026-11-19T12:00:00.000Z");

const stateRecord = (path: string, value: unknown = {}): FeedbackRecord => ({
  type: "feedback_state",
  version: 1,
  payload: { feedback_id: FEEDBACK_ID, path, value },
});

const header = {
  type: "feedback",
  version: 1,
  payload: { feedback_id: FEEDBACK_ID },
} as FeedbackRecord;

const feedbackEvents =
  vi.fn<
    (entries: readonly IFeedbackRecordEntry[], options?: IFeedbackSendCallOptions) => Promise<void>
  >();
const client = { send: feedbackEvents };
const sleep = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>();

const apiError = (status: number) => new FeedbackHttpError(status, "Refused");

const sentTypes = () =>
  feedbackEvents.mock.calls.map(([entries]) => entries.map((entry) => entry.record.type));

beforeEach(() => {
  feedbackEvents.mockReset().mockResolvedValue(undefined);
  sleep.mockReset().mockResolvedValue(undefined);
});

describe("toFeedbackRequests", () => {
  it("keeps the order and starts a new request when the next record would not fit", () => {
    const records = [
      stateRecord("a", "x".repeat(100)),
      stateRecord("b", "x".repeat(100)),
      stateRecord("c", "x".repeat(100)),
      header,
    ];

    const requests = toFeedbackRequests(records, 400);

    expect(requests.map((request) => request.length)).toEqual([2, 2]);
    expect(requests.flat()).toEqual(records);
    expect(requests.at(-1)!.at(-1)).toBe(header);
  });

  it("gives a record over the limit a request of its own", () => {
    const requests = toFeedbackRequests([stateRecord("a", "x".repeat(1000)), header], 400);

    expect(requests.map((request) => request.length)).toEqual([1, 1]);
  });

  it("puts at most 500 records in a request", () => {
    const records = Array.from({ length: 501 }, (_unused, index) => stateRecord(`k${index}`));

    expect(toFeedbackRequests(records).map((request) => request.length)).toEqual([500, 1]);
  });
});

describe("sendFeedback", () => {
  it("sends every record under an id that follows from the feedback", async () => {
    const progress = vi.fn();

    await sendFeedback(client, FEEDBACK_ID, CREATED_AT, [stateRecord("settings"), header], {
      onProgress: progress,
      sleep,
    });

    expect(sentTypes()).toEqual([["feedback_state", "feedback"]]);
    const [entries] = feedbackEvents.mock.calls[0]!;
    expect(entries[0]!.id).toBe(feedbackRecordId(FEEDBACK_ID, "feedback_state", "settings"));
    expect(entries[1]!.id).toBe(feedbackRecordId(FEEDBACK_ID, "feedback", ""));
    expect(entries[0]!.occurredAt).toBe("2026-11-19T12:00:00.000Z");
    expect(entries.map((entry) => entry.key)).toEqual(["settings", ""]);
    expect(progress.mock.calls).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("sends the same ids when the same feedback is sent again", async () => {
    const records = [stateRecord("settings"), header];

    await sendFeedback(client, FEEDBACK_ID, CREATED_AT, records, { sleep });
    await sendFeedback(client, FEEDBACK_ID, CREATED_AT, records, { sleep });

    const ids = feedbackEvents.mock.calls.map(([entries]) => entries.map((entry) => entry.id));
    expect(ids[0]).toEqual(ids[1]);
  });

  it("sends the requests one after another, the feedback record in the last", async () => {
    await sendFeedback(
      client,
      FEEDBACK_ID,
      CREATED_AT,
      [stateRecord("a", "x".repeat(300)), stateRecord("b", "x".repeat(300)), header],
      { sleep, maxRequestBytes: 450 },
    );

    expect(sentTypes()).toEqual([["feedback_state"], ["feedback_state", "feedback"]]);
  });

  it.each([new Error("socket reset"), apiError(503), apiError(500)])(
    "retries a request the service could not take (%s)",
    async (failure) => {
      feedbackEvents.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);

      await sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep });

      expect(feedbackEvents).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1_000, 3_000]);
    },
  );

  it("gives up as unavailable once the retries run out", async () => {
    feedbackEvents.mockRejectedValue(apiError(503));

    const sent = sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep });

    await expect(sent).rejects.toMatchObject({ name: "FeedbackSendError", reason: "unavailable" });
    expect(feedbackEvents).toHaveBeenCalledTimes(4);
  });

  it.each([
    [401, "unauthorized"],
    [404, "refused"],
    [405, "refused"],
    [410, "refused"],
    [413, "refused"],
    [415, "refused"],
    [422, "refused"],
    [429, "rate_limited"],
  ] as const)("does not retry a %i, and reports it as %s", async (status, reason) => {
    feedbackEvents.mockRejectedValueOnce(apiError(status));

    const sent = sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep });

    await expect(sent).rejects.toBeInstanceOf(FeedbackSendError);
    await expect(sent).rejects.toMatchObject({ reason });
    expect(feedbackEvents).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a request that timed out on the service's side", async () => {
    feedbackEvents.mockRejectedValueOnce(apiError(408));

    await sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep });

    expect(feedbackEvents).toHaveBeenCalledTimes(2);
  });

  it("stops at the first request that fails, leaving the feedback record unsent", async () => {
    feedbackEvents.mockRejectedValueOnce(apiError(422));

    await expect(
      sendFeedback(client, FEEDBACK_ID, CREATED_AT, [stateRecord("a", "x".repeat(500)), header], {
        sleep,
        maxRequestBytes: 400,
      }),
    ).rejects.toBeInstanceOf(FeedbackSendError);

    expect(sentTypes()).toEqual([["feedback_state"]]);
  });

  it("sends nothing once the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(FeedbackCanceled);

    expect(feedbackEvents).not.toHaveBeenCalled();
  });

  it("stops at once when a request in flight is aborted, without waiting to retry", async () => {
    const controller = new AbortController();
    feedbackEvents.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
    });

    await expect(
      sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(FeedbackCanceled);

    expect(sleep).not.toHaveBeenCalled();
  });

  it("lets the request with the feedback record finish when canceled, and resolves", async () => {
    const controller = new AbortController();
    feedbackEvents.mockImplementation((_entries, options) => {
      if (options?.finishOnCancel === true) controller.abort();
      return Promise.resolve();
    });

    await sendFeedback(
      client,
      FEEDBACK_ID,
      CREATED_AT,
      [stateRecord("a", "x".repeat(500)), header],
      {
        sleep,
        signal: controller.signal,
        maxRequestBytes: 400,
      },
    );

    expect(feedbackEvents.mock.calls.map(([, options]) => options?.finishOnCancel)).toEqual([
      false,
      true,
    ]);
  });

  it("stops after a wait that the abort cut short", async () => {
    const controller = new AbortController();
    feedbackEvents.mockRejectedValue(apiError(503));
    sleep.mockImplementation(() => {
      controller.abort();
      return Promise.resolve();
    });

    await expect(
      sendFeedback(client, FEEDBACK_ID, CREATED_AT, [header], { sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(FeedbackCanceled);

    expect(feedbackEvents).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1_000, controller.signal);
  });

  it("picks up after the requests an earlier attempt sent", async () => {
    const onProgress = vi.fn<(sent: number, total: number) => void>();
    const records = [stateRecord("a", "x".repeat(200)), stateRecord("b", "y".repeat(200)), header];

    await sendFeedback(client, FEEDBACK_ID, CREATED_AT, records, {
      sleep,
      maxRequestBytes: 300,
      startAt: 1,
      onProgress,
    });

    // the requests are [a] and [b, feedback]: the first went in the earlier attempt
    expect(sentTypes()).toEqual([["feedback_state", "feedback"]]);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
