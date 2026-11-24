import { gunzipSync } from "zlib";

import type { FeedbackRecord } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFeedbackSender,
  encodeFeedbackRequest,
  FeedbackHttpError,
  type IFeedbackRecordEntry,
} from "./service";

const FEEDBACK_ID = "1NG5-K8H7-QX3M-9T2B";
const CLIENT = { name: "vortex", version: "2.12.0", instanceId: "install-1" };

const entry = (key: string, value: unknown): IFeedbackRecordEntry => ({
  id: `00000000-0000-4000-8000-${key.padStart(12, "0")}`,
  occurredAt: "2026-11-19T12:00:00.000Z",
  key,
  record: {
    type: "feedback_state",
    version: 1,
    payload: { feedback_id: FEEDBACK_ID, path: key, value },
  } satisfies FeedbackRecord,
});

const ENTRIES = [entry("a", { text: 'two\nlines "quoted"' }), entry("b", [1, null, 3])];

describe("encodeFeedbackRequest", () => {
  it("puts the client on the first line and one record on each line after it", () => {
    const lines = encodeFeedbackRequest(CLIENT, ENTRIES).split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
    expect(JSON.parse(lines[0]!)).toEqual({
      client: { name: "vortex", version: "2.12.0", instance_id: "install-1" },
    });
    expect(JSON.parse(lines[1]!)).toEqual({
      id: "00000000-0000-4000-8000-00000000000a",
      type: "feedback_state",
      version: 1,
      occurred_at: "2026-11-19T12:00:00.000Z",
      feedback_id: FEEDBACK_ID,
      key: "a",
      payload: { feedback_id: FEEDBACK_ID, path: "a", value: { text: 'two\nlines "quoted"' } },
    });
    expect(JSON.parse(lines[2]!).payload.value).toEqual([1, null, 3]);
  });

  it("leaves out an instance id that is not assigned yet", () => {
    const [first] = encodeFeedbackRequest({ ...CLIENT, instanceId: undefined }, ENTRIES).split(
      "\n",
    );

    expect(JSON.parse(first!)).toEqual({ client: { name: "vortex", version: "2.12.0" } });
  });
});

const ok = () => new Response('{"data":{"accepted":2}}', { status: 200 });
const problem = (status: number, detail: string) =>
  new Response(JSON.stringify({ status, detail }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });

describe("createFeedbackSender", () => {
  const fetchMock = vi.fn<typeof fetch>();

  const sender = (signal?: AbortSignal) =>
    createFeedbackSender({
      baseUrl: "https://feedback.test/",
      client: CLIENT,
      token: "token-1",
      signal,
      fetch: fetchMock,
    });

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(ok());
  });

  it("lets a request asked to finish on cancel outlive the caller's signal", async () => {
    const controller = new AbortController();

    await sender(controller.signal).send(ENTRIES, { finishOnCancel: true });

    const init = fetchMock.mock.calls[0]![1];
    controller.abort();
    expect(init?.signal?.aborted).toBe(false);
  });

  it("POSTs the request compressed, with the login", async () => {
    const controller = new AbortController();

    await sender(controller.signal).send(ENTRIES);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://feedback.test/v1/records");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer token-1",
      "Content-Type": "application/x-ndjson",
      "Content-Encoding": "gzip",
    });
    // the caller's signal still stops the request
    expect(init?.signal?.aborted).toBe(false);
    controller.abort();
    expect(init?.signal?.aborted).toBe(true);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const sent = gunzipSync(init?.body as Uint8Array).toString("utf8");
    expect(sent).toBe(encodeFeedbackRequest(CLIENT, ENTRIES));
  });

  it("reports a 401 for the renderer to renew the login, without sending again", async () => {
    fetchMock.mockResolvedValue(problem(401, "The bearer token is not valid."));

    await expect(sender().send(ENTRIES)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports the service's own words for a refusal", async () => {
    fetchMock.mockResolvedValue(problem(422, "Line 3: payload.part: expected integer."));

    const sent = sender().send(ENTRIES);

    await expect(sent).rejects.toBeInstanceOf(FeedbackHttpError);
    await expect(sent).rejects.toMatchObject({
      status: 422,
      message: "Line 3: payload.part: expected integer.",
    });
  });

  it("falls back to the status when the answer is not a problem document", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));

    await expect(sender().send(ENTRIES)).rejects.toMatchObject({
      status: 502,
      message: "The feedback service answered 502.",
    });
  });

  it("lets a network failure through as it is, for the caller to retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(sender().send(ENTRIES)).rejects.toBeInstanceOf(TypeError);
  });

  it("gives up on a request that stalls, without aborting the caller's signal", async () => {
    // a fetch that only ever settles when its signal aborts, as a stalled connection does
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const reason: unknown = init.signal?.reason;
            reject(reason instanceof Error ? reason : new Error(String(reason)));
          });
        }),
    );
    const controller = new AbortController();
    const stalled = createFeedbackSender({
      baseUrl: "https://feedback.test/",
      client: CLIENT,
      token: "token-1",
      signal: controller.signal,
      timeoutMs: 10,
      fetch: fetchMock,
    });

    await expect(stalled.send(ENTRIES)).rejects.toMatchObject({ name: "TimeoutError" });
    // so the send is retried as a failure, not taken for a cancel
    expect(controller.signal.aborted).toBe(false);
  });
});
