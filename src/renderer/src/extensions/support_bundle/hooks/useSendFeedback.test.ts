import { act, renderHook, waitFor } from "@testing-library/react";
import type { FeedbackSendResult, IFeedbackSendRequest } from "@vortex/shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSendFeedback, type IFeedbackForm } from "./useSendFeedback";

const { buildRequestMock, newIdMock, getAccessTokenMock } = vi.hoisted(() => ({
  buildRequestMock: vi.fn(),
  newIdMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
}));

vi.mock("react-redux", () => ({ useStore: () => ({ getState: () => ({}) }) }));
vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({ getApi: () => ({ sendNotification: vi.fn() }) }),
}));
vi.mock("@/extensions/nexus_integration/util/oauthSession", () => ({
  getAccessToken: getAccessTokenMock,
}));
vi.mock("@/util/log", () => ({ log: vi.fn() }));
vi.mock("../util/collectFeedback", () => ({ buildFeedbackRequest: buildRequestMock }));
vi.mock("../util/feedbackIds", () => ({ newFeedbackId: newIdMock }));

const feedbackApi = {
  send: vi.fn<(request: IFeedbackSendRequest, token: string) => Promise<FeedbackSendResult>>(),
  progress: vi.fn(() => Promise.resolve(null)),
  discard: vi.fn(() => Promise.resolve()),
  releaseReplay: vi.fn(),
};

const FORM: IFeedbackForm = {
  text: "The mod list is empty.",
  includeSupportData: true,
  logWindowMinutes: 60,
  screenshot: undefined,
  includeReplay: false,
};

const SENT: FeedbackSendResult = { status: "sent" };
const UNAVAILABLE: FeedbackSendResult = {
  status: "failed",
  reason: "unavailable",
  message: "socket reset",
};
const UNAUTHORIZED: FeedbackSendResult = {
  status: "failed",
  reason: "unauthorized",
  message: "The bearer token is not valid.",
};

/** Sends the form and waits until the attempt has failed or succeeded. */
const sendAndSettle = async (
  result: { current: ReturnType<typeof useSendFeedback> },
  form: IFeedbackForm,
) => {
  act(() => result.current.send(form));
  await waitFor(() => expect(["failed", "sent"]).toContain(result.current.state.status));
};

beforeEach(() => {
  vi.clearAllMocks();
  let nextId = 0;
  newIdMock.mockImplementation(() => `ID-${++nextId}`);
  // a new object each build, so a test can tell whether a retry reused the first one
  buildRequestMock.mockImplementation((_state, input: { feedbackId: string; createdAt: Date }) => ({
    feedbackId: input.feedbackId,
    createdAt: input.createdAt.getTime(),
  }));
  getAccessTokenMock.mockResolvedValue("token-1");
  (window as unknown as { api: { feedback: typeof feedbackApi } }).api.feedback = feedbackApi;
});

describe("useSendFeedback", () => {
  it("sends the same request again when it is retried, for main to pick up where it stopped", async () => {
    feedbackApi.send.mockResolvedValueOnce(UNAVAILABLE).mockResolvedValueOnce(SENT);
    const { result } = renderHook(() => useSendFeedback(true));

    await sendAndSettle(result, FORM);
    expect(result.current.state).toMatchObject({ status: "failed", reason: "unavailable" });
    await sendAndSettle(result, { ...FORM });

    expect(result.current.state).toEqual({ status: "sent", feedbackId: "ID-1" });
    expect(buildRequestMock).toHaveBeenCalledTimes(1);
    const [first, second] = feedbackApi.send.mock.calls;
    expect(second![0]).toBe(first![0]);
    expect(feedbackApi.discard).not.toHaveBeenCalled();
  });

  it("gives a feedback changed after a failure an id of its own, and drops the old one", async () => {
    feedbackApi.send.mockResolvedValueOnce(UNAVAILABLE).mockResolvedValueOnce(SENT);
    const { result } = renderHook(() => useSendFeedback(true));

    await sendAndSettle(result, FORM);
    act(() => result.current.edit());
    await sendAndSettle(result, { ...FORM, includeSupportData: false });

    expect(result.current.state).toEqual({ status: "sent", feedbackId: "ID-2" });
    expect(feedbackApi.discard).toHaveBeenCalledWith("ID-1");
    const [first, second] = feedbackApi.send.mock.calls;
    expect(first![0].feedbackId).toBe("ID-1");
    expect(second![0].feedbackId).toBe("ID-2");
    // the logs still reach back from when the dialog opened
    expect(second![0].createdAt).toBe(first![0].createdAt);
  });

  it("renews a refused login once and sends again with the new one", async () => {
    feedbackApi.send.mockResolvedValueOnce(UNAUTHORIZED).mockResolvedValueOnce(SENT);
    getAccessTokenMock.mockResolvedValueOnce("token-1").mockResolvedValueOnce("token-2");
    const { result } = renderHook(() => useSendFeedback(true));

    await sendAndSettle(result, FORM);

    expect(result.current.state).toEqual({ status: "sent", feedbackId: "ID-1" });
    expect(getAccessTokenMock).toHaveBeenLastCalledWith(expect.anything(), "token-1");
    expect(feedbackApi.send.mock.calls.map(([, token]) => token)).toEqual(["token-1", "token-2"]);
  });

  it.each([
    ["the renewal is refused", () => Promise.reject(new Error("refresh refused"))],
    ["the renewal gives the same login", () => Promise.resolve("token-1")],
  ])("reports the refused login when %s", async (_name, renew) => {
    feedbackApi.send.mockResolvedValue(UNAUTHORIZED);
    getAccessTokenMock.mockResolvedValueOnce("token-1").mockImplementationOnce(renew);
    const { result } = renderHook(() => useSendFeedback(true));

    await sendAndSettle(result, FORM);

    expect(result.current.state).toMatchObject({ status: "failed", reason: "unauthorized" });
    expect(feedbackApi.send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing without a login", async () => {
    getAccessTokenMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSendFeedback(true));

    await sendAndSettle(result, FORM);

    expect(result.current.state).toMatchObject({ status: "failed", reason: "unauthorized" });
    expect(feedbackApi.send).not.toHaveBeenCalled();
  });

  it("has main drop the feedback when the dialog closes", () => {
    const { rerender } = renderHook(({ visible }) => useSendFeedback(visible), {
      initialProps: { visible: true },
    });

    rerender({ visible: false });

    expect(feedbackApi.discard).toHaveBeenCalledWith("ID-1");
  });
});
