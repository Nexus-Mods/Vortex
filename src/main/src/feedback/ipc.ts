/**
 * IPC for a user's feedback. Main does the work: it keeps the window recording the renderer hands
 * it, reads the logs, crash dumps and persisted state, builds the records and sends them. The
 * renderer gives what only it has, the text, the session state and the login, and only main can
 * capture a window.
 */
import { getErrorMessageOrDefault } from "@vortex/shared";
import { app } from "electron";

import { getVortexPath } from "../getVortexPath";
import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import { readPersistedRows } from "../store/mainPersistence";
import { getExportedTraceIds } from "../telemetry/state";
import { feedbackApiBase } from "./apiBase";
import { captureAsJpeg } from "./capture";
import { summarizeLatestDumps } from "./crashSummaries";
import { FeedbackJobs } from "./jobs";
import { addReplayBatch, freezeReplay, frozenReplay, releaseReplay, resetReplay } from "./replay";
import { FEEDBACK_SERVICE_URL } from "./service";

export function initFeedbackIpc(): void {
  const jobs = new FeedbackJobs({
    sources: {
      userData: getVortexPath("userData"),
      crashSummaries: () => summarizeLatestDumps(app.getPath("crashDumps")),
      traceIds: getExportedTraceIds,
      replay: frozenReplay,
      persistedRows: readPersistedRows,
    },
    baseUrl: () => feedbackApiBase() ?? FEEDBACK_SERVICE_URL,
    version: () => app.getVersion(),
  });

  betterIpcMain.on("feedback:replay-batch", (_event, batch) => void addReplayBatch(batch));
  betterIpcMain.on("feedback:replay-reset", () => resetReplay());
  betterIpcMain.on("feedback:replay-release", () => releaseReplay());
  betterIpcMain.handle("feedback:freeze-replay", () => freezeReplay());

  betterIpcMain.handle("feedback:send", (_event, request, token) => jobs.send(request, token));
  betterIpcMain.handle("feedback:progress", (_event, feedbackId) =>
    Promise.resolve(jobs.progress(feedbackId)),
  );
  betterIpcMain.handle("feedback:cancel", (_event, feedbackId) => {
    jobs.cancel(feedbackId);
    return Promise.resolve();
  });
  betterIpcMain.handle("feedback:discard", (_event, feedbackId) => {
    jobs.discard(feedbackId);
    return Promise.resolve();
  });

  betterIpcMain.handle("feedback:capture-window", async (event) => {
    try {
      return await captureAsJpeg(event.sender);
    } catch (err) {
      // a screenshot is optional, so the feedback goes without one
      log("warn", "failed to capture the window for feedback", {
        error: getErrorMessageOrDefault(err),
      });
      return null;
    }
  });
}
