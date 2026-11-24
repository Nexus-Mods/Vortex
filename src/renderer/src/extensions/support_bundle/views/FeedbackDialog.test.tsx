import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IFeedbackScreenshot } from "@vortex/shared/ipc";
import React from "react";
import { Provider } from "react-redux";
import type { Store } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDialogVisible } from "@/actions";
import { settleTransitions } from "@/test-utils/transitions";
import type { IState } from "@/types/IState";
import { UserCanceled } from "@/util/CustomErrors";

import type { ISendFeedbackControls, SendState } from "../hooks/useSendFeedback";
import { FeedbackDialog } from "./FeedbackDialog";

const {
  useSendFeedbackMock,
  takeCaptureMock,
  takeRecordingMock,
  reopenMock,
  emitMock,
  hasOAuthLoginMock,
} = vi.hoisted(() => ({
  hasOAuthLoginMock: vi.fn(),
  useSendFeedbackMock: vi.fn(),
  takeCaptureMock: vi.fn(),
  takeRecordingMock: vi.fn(),
  reopenMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("../hooks/useSendFeedback", () => ({ useSendFeedback: useSendFeedbackMock }));
vi.mock("../util/openFeedbackDialog", () => ({
  takeFeedbackCapture: takeCaptureMock,
  takeFeedbackRecording: takeRecordingMock,
  reopenFeedbackDialog: reopenMock,
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ hasOAuthLogin: hasOAuthLoginMock }));
vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({ getApi: () => ({ events: { emit: emitMock } }) }),
}));

const FEEDBACK_ID = "1NG5-K8H7-QX3M-9T2B";
const CAPTURE: IFeedbackScreenshot = { mime: "image/jpeg", width: 4, height: 2, data: "AAAA" };
const RECORDING = { startsAt: 1, endsAt: 2, eventCount: 2 };

const dispatch = vi.fn();
const fakeStore = {
  getState: () => ({}),
  subscribe: () => () => {},
  dispatch,
} as unknown as Store<IState>;

const send = vi.fn<ISendFeedbackControls["send"]>();
const edit = vi.fn<ISendFeedbackControls["edit"]>();

const withState = (state: SendState): void => {
  useSendFeedbackMock.mockReturnValue({ state, send, edit });
};

const renderDialog = (onHide: () => void = vi.fn()) =>
  render(
    <Provider store={fakeStore}>
      <FeedbackDialog visible={true} onHide={onHide} />
    </Provider>,
  );

/** Opens the dialog and takes the "send it to the team" choice, which shows the form. */
const renderForm = async (onHide: () => void = vi.fn()) => {
  const rendered = renderDialog(onHide);
  await userEvent.click(screen.getByTestId("feedback-choose-send"));
  return rendered;
};

/** As `renderForm`, with "Advanced options" ticked, which shows what can be left out. */
const renderAdvancedForm = async () => {
  const rendered = await renderForm();
  await userEvent.click(screen.getByTestId("feedback-advanced"));
  return rendered;
};

const clipboard = () =>
  (window as unknown as { api: { clipboard: { writeText: ReturnType<typeof vi.fn> } } }).api
    .clipboard;

beforeEach(() => {
  vi.clearAllMocks();
  takeCaptureMock.mockReturnValue(undefined);
  takeRecordingMock.mockReturnValue(undefined);
  reopenMock.mockImplementation((_capture: unknown, show: () => void) => {
    show();
    return Promise.resolve();
  });
  hasOAuthLoginMock.mockReturnValue(true);
  withState({ status: "editing" });
  (window as unknown as { api: Record<string, unknown> }).api = {
    ...(window as unknown as { api?: Record<string, unknown> }).api,
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  };
});

describe("FeedbackDialog", () => {
  it("first asks how to share the feedback, and shows no form yet", async () => {
    renderDialog();

    expect(screen.getByTestId("feedback-choose-send")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-choose-bundle")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-send")).not.toBeInTheDocument();
    await settleTransitions();
  });

  it("asks a user on an old API key login to log in again, and still offers the bundle", async () => {
    hasOAuthLoginMock.mockReturnValue(false);
    renderDialog();

    expect(screen.queryByTestId("feedback-choose-send")).not.toBeInTheDocument();
    expect(screen.getByTestId("feedback-choose-bundle")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("feedback-choose-login"));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("login-dialog"));
    expect(emitMock).toHaveBeenCalledWith("request-nexus-login", expect.any(Function));
    expect(screen.queryByTestId("feedback-text")).not.toBeInTheDocument();
  });

  it("opens the support bundle dialog in its place when that is chosen", async () => {
    renderDialog();

    await userEvent.click(screen.getByTestId("feedback-choose-bundle"));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("support-bundle-dialog"));
    expect(emitMock).toHaveBeenCalledWith(
      "analytics-track-mixpanel-event",
      expect.objectContaining({
        eventName: "app_support_bundle_clicked",
        properties: { source: "feedback_dialog" },
      }),
    );
  });

  it("goes back from the form to the choice", async () => {
    await renderForm();

    await userEvent.click(screen.getByTestId("feedback-back"));

    expect(screen.getByTestId("feedback-choose")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-text")).not.toBeInTheDocument();
  });

  it("shows the text box alone until the advanced options are asked for", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    await renderForm();

    expect(screen.getByTestId("feedback-text")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-include-support-data")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-log-window")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-include-screenshot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-screenshot-preview")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("feedback-advanced"));

    expect(screen.getByTestId("feedback-include-support-data")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-log-window")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-include-screenshot")).toBeInTheDocument();
  });

  it("sends the support data, and no screenshot, when the options were never opened", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    await renderForm();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith({
      text: "It broke",
      includeSupportData: true,
      logWindowMinutes: 60,
      screenshot: undefined,
      includeReplay: false,
    });
  });

  it("keeps what was chosen when the advanced options are hidden again", async () => {
    await renderAdvancedForm();

    await userEvent.click(screen.getByTestId("feedback-include-support-data"));
    await userEvent.click(screen.getByTestId("feedback-advanced"));
    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ includeSupportData: false }));
  });

  it("keeps Send disabled until something is written", async () => {
    await renderForm();

    expect(screen.getByTestId("feedback-send")).toBeDisabled();

    await userEvent.type(screen.getByTestId("feedback-text"), "   ");
    expect(screen.getByTestId("feedback-send")).toBeDisabled();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    expect(screen.getByTestId("feedback-send")).toBeEnabled();
  });

  it("sends the trimmed text with the support data by default", async () => {
    await renderForm();

    await userEvent.type(screen.getByTestId("feedback-text"), "  It broke  ");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith({
      text: "It broke",
      includeSupportData: true,
      logWindowMinutes: 60,
      screenshot: undefined,
      includeReplay: false,
    });
  });

  it("starts the log period at one hour, on a slider from 10 minutes to 12 hours", async () => {
    await renderAdvancedForm();

    const slider = screen.getByTestId("feedback-log-window");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "13");
    expect(slider).toHaveValue("2");
  });

  it.each([
    [0, 10],
    [1, 30],
    [3, 120],
    [13, 720],
  ])("sends the log period at slider stop %i as %i minutes", async (stop, minutes) => {
    await renderAdvancedForm();

    fireEvent.change(screen.getByTestId("feedback-log-window"), { target: { value: stop } });
    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ logWindowMinutes: minutes }));
  });

  it("offers no log period once the support data is unticked", async () => {
    await renderAdvancedForm();

    await userEvent.click(screen.getByTestId("feedback-include-support-data"));

    expect(screen.queryByTestId("feedback-log-window")).not.toBeInTheDocument();
  });

  it("sends the text alone once the support data is unticked", async () => {
    await renderAdvancedForm();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-include-support-data"));
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ includeSupportData: false }));
  });

  it("leaves the screenshot out, and shows none, until it is asked for", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    await renderAdvancedForm();

    expect(screen.getByTestId("feedback-include-screenshot")).not.toBeChecked();
    expect(screen.queryByTestId("feedback-screenshot-preview")).not.toBeInTheDocument();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ screenshot: undefined }));
  });

  it("shows the capture taken as the dialog opened once it is ticked, and sends it", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    await renderAdvancedForm();

    await userEvent.click(screen.getByTestId("feedback-include-screenshot"));

    expect(screen.getByTestId("feedback-screenshot-preview")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,AAAA",
    );

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ screenshot: CAPTURE }));
  });

  it("leaves the screenshot out once it is unticked again", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    await renderAdvancedForm();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-include-screenshot"));
    await userEvent.click(screen.getByTestId("feedback-include-screenshot"));

    expect(screen.queryByTestId("feedback-screenshot-preview")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ screenshot: undefined }));
  });

  it("leaves the recording out until it is ticked, then sends the one taken as the dialog opened", async () => {
    takeRecordingMock.mockReturnValue(RECORDING);
    await renderAdvancedForm();

    expect(screen.getByTestId("feedback-include-replay")).not.toBeChecked();

    await userEvent.type(screen.getByTestId("feedback-text"), "It broke");
    await userEvent.click(screen.getByTestId("feedback-include-replay"));
    await userEvent.click(screen.getByTestId("feedback-send"));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ includeReplay: true }));
  });

  it("offers no recording when nothing was recorded", async () => {
    await renderAdvancedForm();

    expect(screen.queryByTestId("feedback-include-replay")).not.toBeInTheDocument();
    await settleTransitions();
  });

  it("offers no screenshot when none could be taken", async () => {
    await renderAdvancedForm();

    expect(screen.queryByTestId("feedback-include-screenshot")).not.toBeInTheDocument();
    await settleTransitions();
  });

  it("shows progress in place of the form while sending", async () => {
    withState({ status: "sending", sent: 1, total: 3 });
    renderDialog();

    expect(screen.getByTestId("feedback-sending")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-send")).not.toBeInTheDocument();
    await settleTransitions();
  });

  it("shows the feedback's id once sent, and copies it", async () => {
    withState({ status: "sent", feedbackId: FEEDBACK_ID });
    renderDialog();

    expect(screen.getByTestId("feedback-id")).toHaveTextContent(FEEDBACK_ID);
    // nothing of the form is left to look as if it still needed doing
    expect(screen.queryByTestId("feedback-text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-send")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feedback-advanced")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(
      expect.arrayContaining(["feedback::buttons::copyId", "feedback::buttons::close"]),
    );

    await userEvent.click(screen.getByTestId("feedback-copy-id"));

    expect(clipboard().writeText).toHaveBeenCalledWith(FEEDBACK_ID);
  });

  it("offers to try again or go back after a failure", async () => {
    withState({ status: "failed", reason: "unavailable", message: "socket reset" });
    renderDialog();

    expect(screen.getByTestId("feedback-error")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("feedback-retry"));
    expect(send).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId("feedback-edit"));
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it.each(["rate_limited", "refused"] as const)(
    "offers no retry when sending again cannot help (%s)",
    async (reason) => {
      withState({ status: "failed", reason, message: "refused" });
      renderDialog();

      expect(screen.queryByTestId("feedback-retry")).not.toBeInTheDocument();
      expect(screen.getByTestId("feedback-edit")).toBeInTheDocument();
      await settleTransitions();
    },
  );

  it("offers to log in again, not to retry, when the login was not accepted", async () => {
    withState({
      status: "failed",
      reason: "unauthorized",
      message: "Not logged in to Nexus Mods.",
    });
    renderDialog();

    expect(screen.queryByTestId("feedback-retry")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("feedback-login"));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("login-dialog"));
    expect(emitMock).toHaveBeenCalledWith("request-nexus-login", expect.any(Function));
  });

  it("keeps what the user wrote through logging in again, and reopens with it", async () => {
    const dialog = (visible: boolean) => (
      <Provider store={fakeStore}>
        <FeedbackDialog visible={visible} onHide={vi.fn()} />
      </Provider>
    );
    const { rerender } = await renderForm();
    await userEvent.type(screen.getByTestId("feedback-text"), "The mod list is empty.");

    withState({ status: "failed", reason: "unauthorized", message: "Refused." });
    rerender(dialog(true));
    await userEvent.click(screen.getByTestId("feedback-login"));

    // logging in takes the dialog's place, then brings it back once it succeeds
    const done = emitMock.mock.calls.find(([event]) => event === "request-nexus-login")![1] as (
      err: Error | null,
    ) => void;
    done(null);
    expect(dispatch).toHaveBeenLastCalledWith(setDialogVisible("feedback-dialog"));

    withState({ status: "editing" });
    rerender(dialog(false));
    await settleTransitions();
    rerender(dialog(true));

    expect(await screen.findByTestId("feedback-text")).toHaveValue("The mod list is empty.");
    await settleTransitions();
  });

  it("reopens with the capture it had after logging in again", async () => {
    takeCaptureMock.mockReturnValue(CAPTURE);
    withState({ status: "failed", reason: "unauthorized", message: "Refused." });
    renderDialog();

    await userEvent.click(screen.getByTestId("feedback-login"));
    const done = emitMock.mock.calls.find(([event]) => event === "request-nexus-login")![1] as (
      err: Error | null,
    ) => void;
    done(null);

    expect(reopenMock).toHaveBeenCalledWith(CAPTURE, expect.any(Function));
  });

  it("forgets what the user wrote when logging in doesn't succeed", async () => {
    const dialog = (visible: boolean) => (
      <Provider store={fakeStore}>
        <FeedbackDialog visible={visible} onHide={vi.fn()} />
      </Provider>
    );
    const { rerender } = await renderForm();
    await userEvent.type(screen.getByTestId("feedback-text"), "The mod list is empty.");

    withState({ status: "failed", reason: "unauthorized", message: "Refused." });
    rerender(dialog(true));
    await userEvent.click(screen.getByTestId("feedback-login"));
    const done = emitMock.mock.calls.find(([event]) => event === "request-nexus-login")![1] as (
      err: Error | null,
    ) => void;
    done(new UserCanceled());
    expect(reopenMock).not.toHaveBeenCalled();

    withState({ status: "editing" });
    rerender(dialog(false));
    await settleTransitions();
    rerender(dialog(true));

    expect(await screen.findByTestId("feedback-choose")).toBeInTheDocument();
    await settleTransitions();
  });

  it("closes through the secondary button", async () => {
    const onHide = vi.fn();
    renderDialog(onHide);

    await userEvent.click(screen.getByTestId("feedback-close"));

    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
