import { gunzipSync } from "node:zlib";

import { DEFAULT_LOG_WINDOW_MINUTES } from "@vortex/shared";
import type { IFeedbackSendRequest, IFeedbackSupportData } from "@vortex/shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackJobs } from "./jobs";

vi.mock("../logging", () => ({ log: vi.fn<() => void>() }));

const REQUEST: IFeedbackSendRequest = {
  feedbackId: "1NG5-K8H7-QX3M-9T2B",
  createdAt: Date.parse("2026-11-19T12:00:00.000Z"),
  text: "The mod list is empty.",
  game: null,
  nexusGameId: null,
  instanceId: "install-1",
  supportData: undefined,
  screenshot: undefined,
  includeReplay: false,
};

const SUPPORT_DATA: IFeedbackSupportData = {
  logWindowMinutes: DEFAULT_LOG_WINDOW_MINUTES,
  session: undefined,
};

const fetchMock = vi.fn<typeof fetch>();
const crashSummaries = vi.fn(() => Promise.resolve([]));

const jobs = () =>
  new FeedbackJobs({
    sources: {
      userData: "/nowhere",
      crashSummaries,
      traceIds: () => [],
      replay: () => undefined,
      persistedRows: () => Promise.resolve([]),
    },
    baseUrl: () => "https://feedback.test",
    version: () => "2.12.0",
    fetch: fetchMock,
    sleep: () => Promise.resolve(),
  });

/** The records of each request made so far, as sent. */
const sentLines = (): unknown[][] =>
  fetchMock.mock.calls.map(([, init]) =>
    gunzipSync(init?.body as Uint8Array)
      .toString("utf8")
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => JSON.parse(line) as unknown),
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("FeedbackJobs", () => {
  it("sends the feedback with the login it was given", async () => {
    expect(await jobs().send(REQUEST, "token-1")).toEqual({ status: "sent" });

    expect(fetchMock.mock.calls[0]![1]?.headers).toMatchObject({
      Authorization: "Bearer token-1",
    });
    expect(sentLines()[0]).toEqual([expect.objectContaining({ type: "feedback" })]);
  });

  it("sends the records of the failed attempt again on a retry of the same feedback", async () => {
    const feedbacks = jobs();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await feedbacks.send(REQUEST, "token-1")).toMatchObject({
      status: "failed",
      reason: "unavailable",
    });

    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await feedbacks.send(REQUEST, "token-1")).toEqual({ status: "sent" });

    const lines = sentLines();
    expect(lines.at(-1)).toEqual(lines[0]);
  });

  it("reports a refused login for the renderer to renew", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    expect(await jobs().send(REQUEST, "token-1")).toMatchObject({
      status: "failed",
      reason: "unauthorized",
    });
  });

  it("resolves as canceled when the send is stopped before it goes out", async () => {
    const feedbacks = jobs();
    const crashes = Promise.withResolvers<never[]>();
    crashSummaries.mockImplementationOnce(() => crashes.promise);

    const sending = feedbacks.send({ ...REQUEST, supportData: SUPPORT_DATA }, "token-1");
    await vi.waitFor(() => expect(crashSummaries).toHaveBeenCalled());
    feedbacks.cancel(REQUEST.feedbackId);
    crashes.resolve([]);

    expect(await sending).toEqual({ status: "canceled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the request that completes the feedback finish when stopped, and reports it sent", async () => {
    const feedbacks = jobs();
    const response = Promise.withResolvers<Response>();
    fetchMock.mockImplementation(() => response.promise);

    const sending = feedbacks.send(REQUEST, "token-1");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(feedbacks.progress(REQUEST.feedbackId)).toEqual({ sent: 0, total: 1 });
    feedbacks.cancel(REQUEST.feedbackId);
    response.resolve(new Response(null, { status: 200 }));

    // the service stored it, so the user gets its id rather than a send that seems lost
    expect(await sending).toEqual({ status: "sent" });
    expect(feedbacks.progress(REQUEST.feedbackId)).toBeNull();
  });

  it("reads no crash dumps for a feedback sent without support data", async () => {
    await jobs().send(REQUEST, "token-1");

    expect(crashSummaries).not.toHaveBeenCalled();
  });
});
