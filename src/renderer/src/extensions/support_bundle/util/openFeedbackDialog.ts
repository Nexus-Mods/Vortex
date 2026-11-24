import type { IFeedbackReplayInfo, IFeedbackScreenshot } from "@vortex/shared/ipc";

import { log } from "@/util/log";

import { flushFeedbackReplay } from "./feedbackReplay";

/** Long enough for the menu the dialog was opened from to have gone. */
const MENU_CLOSE_MS = 250;

/**
 * The capture taken as the dialog was asked for. It is taken before the dialog shows, since a
 * capture taken from inside the dialog would be a picture of the dialog.
 */
let pending: IFeedbackScreenshot | undefined;

/** The screen recording main put aside as the dialog was asked for. */
let pendingReplay: IFeedbackReplayInfo | undefined;

/** Hands the capture to the dialog, once. */
export function takeFeedbackCapture(): IFeedbackScreenshot | undefined {
  const capture = pending;
  pending = undefined;
  return capture;
}

/** Hands what is known of the recording to the dialog, once. */
export function takeFeedbackRecording(): IFeedbackReplayInfo | undefined {
  const replay = pendingReplay;
  pendingReplay = undefined;
  return replay;
}

/** Puts the recording up to now aside in main, which keeps it for the dialog. */
async function freezeRecording(): Promise<IFeedbackReplayInfo | undefined> {
  try {
    // the events recorded since the last batch go first, so main has them all
    flushFeedbackReplay();
    return (await window.api.feedback.freezeReplay()) ?? undefined;
  } catch (err) {
    log("warn", "failed to keep the window recording for feedback", { error: err });
    return undefined;
  }
}

/** Captures the window as the user sees it now, then shows the feedback dialog. */
export async function openFeedbackDialog(show: () => void): Promise<void> {
  pending = undefined;
  // first, so the recording ends before the menu closes and the dialog opens
  pendingReplay = await freezeRecording();
  try {
    await new Promise((resolve) => setTimeout(resolve, MENU_CLOSE_MS));
    pending = (await window.api.feedback.captureWindow()) ?? undefined;
  } catch (err) {
    // the screenshot is optional, so the dialog opens without one
    log("warn", "failed to capture the window for feedback", { error: err });
  }
  show();
}

/**
 * Shows the dialog again after something took its place, such as logging in, with the capture it
 * had: a new one would be a picture of whatever took its place. Closing the dialog let go of the
 * recording, so it is put aside again; it still covers the time before the dialog first opened.
 */
export async function reopenFeedbackDialog(
  capture: IFeedbackScreenshot | undefined,
  show: () => void,
): Promise<void> {
  pendingReplay = await freezeRecording();
  pending = capture;
  show();
}
