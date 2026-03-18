import { getErrorMessage } from "@vortex/shared";
import { UserCanceled } from "@vortex/shared/errors";
import { app, dialog } from "electron";

import {
  reportCrash,
  errorToReportableError,
  disableErrorReporting,
  isErrorReportingDisabled,
} from "./errorReporting";
import { log } from "./logging";

/** Terminates the applpication on an error */
export function terminate(error: Error): void {
  terminateAsync(error).catch(() => {
    /* ignored */
  });

  throw new UserCanceled();
}

export async function terminateAsync(error: Error): Promise<void> {
  log("error", "unrecoverable error", error);

  const allowReport = !isErrorReportingDisabled();

  // dialog.showMessageBox requires the app to be ready. If we crash
  // before that, fall back to the synchronous showErrorBox + direct report.
  if (!app.isReady()) {
    dialog.showErrorBox(
      "An unrecoverable error occurred",
      getErrorMessage(error) + "\n\n" + (error.stack ?? ""),
    );
    if (allowReport) {
      await reportCrash("Crash", errorToReportableError(error)).catch(() => {
        /* best-effort */
      });
    }
    app.exit(1);
    return;
  }

  try {
    const isIgnored = await showTerminateError(error, allowReport, false);
    if (isIgnored) return;
  } catch (err) {
    log("error", "error while handling unrecoverable error", err);
  }

  app.exit(1);
}

const BUTTON_IGNORE = "Ignore";
const BUTTON_QUIT = "Quit";
const BUTTON_DETAILS = "Show Details";
const BUTTON_REPORT = "Report and Quit";
const BUTTON_CONFIRM = "I understand";

/** @returns true if the user ignores the error */
async function showTerminateError(
  error: Error,
  allowReport: boolean,
  withDetails: boolean,
): Promise<boolean> {
  const buttons = [BUTTON_IGNORE, BUTTON_QUIT];
  if (!withDetails) {
    buttons.unshift(BUTTON_DETAILS);
  }

  if (allowReport) {
    buttons.push(BUTTON_REPORT);
  }

  const detail = withDetails ? errorToDetails(error) : "";

  const result = await dialog.showMessageBox({
    type: "error",
    title: "An unrecoverable error occurred",
    message: getErrorMessage(error),
    detail: detail,
    buttons: buttons,
    defaultId: buttons.length - 1,
    noLink: true,
  });

  const response = buttons[result.response];
  if (response === BUTTON_REPORT) {
    await reportCrash("Crash", errorToReportableError(error));
    return false;
  }

  if (response === BUTTON_IGNORE) {
    const shouldIgnore = await confirmIgnoreError();
    if (shouldIgnore) {
      log("info", "user ignored unrecoverable error, disabling reporting");
      disableErrorReporting();
    }

    return shouldIgnore;
  }

  if (response === BUTTON_DETAILS) {
    return showTerminateError(error, allowReport, true);
  }

  return false;
}

async function confirmIgnoreError(): Promise<boolean> {
  const buttons = [BUTTON_QUIT, BUTTON_CONFIRM];

  const result = await dialog.showMessageBox({
    type: "error",
    title: "Are you sure?",
    message:
      "The error was unhandled which may lead to unforeseen consequences including data loss. " +
      "Continue at your own risk. Please do not report any issues that arise from here on out, as they are very likely to be caused by the unhandled error. ",
    buttons: buttons,
    noLink: true,
  });

  const response = buttons[result.response];
  return response === BUTTON_CONFIRM;
}

function errorToDetails<E extends object = Error>(error: E): string {
  let detail = "";

  if ("stack" in error && typeof error.stack === "string") {
    detail += "\n" + error.stack;
  }

  if ("path" in error && typeof error.path === "string") {
    detail = "File: " + error.path + "\n" + detail;
  }

  if ("code" in error && typeof error.code === "string") {
    detail = error.code + "\n" + detail;
  }

  if ("details" in error && typeof error.details === "string") {
    detail = error.details + "\n" + detail;
  }

  return detail;
}
