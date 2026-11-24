import * as os from "node:os";
import { setImmediate as yieldToLoop } from "node:timers/promises";

import { getErrorMessageOrDefault, hasNonAscii, redactSensitiveText } from "@vortex/shared";
import type { IFeedbackCrashDump, IFeedbackSendRequest } from "@vortex/shared/ipc";

import { log } from "../logging";
import { readRecentLogs } from "./logs";
import { packReplay, type IPackedReplay } from "./packReplay";
import { readPersistedFeedbackState, type ReadPersistedRows } from "./persistedState";
import type { IFeedbackContent } from "./records";
import type { ReplaySegment } from "./replay";
import { trimFeedbackState } from "./trimState";

/** Where main finds what a feedback holds besides what the renderer sent. */
export interface IFeedbackSources {
  /** the folder the logs are written to, which is also the user's data folder */
  userData: string;
  crashSummaries: () => Promise<IFeedbackCrashDump[]>;
  /** ids of the traces exported so far in this session */
  traceIds: () => string[];
  /** the recording put aside as the dialog opened */
  replay: () => readonly ReplaySegment[] | undefined;
  /** the rows of a hive main persists, once the changes sent so far are written */
  persistedRows: ReadPersistedRows;
}

/**
 * The state export by hive, redacted as a support bundle's is and without what the team can get
 * elsewhere (`trimFeedbackState`). Main reads the hives it persists itself, leaving out most of
 * what is trimmed without reading it; only `session`, which lives in the renderer alone, comes
 * over, as JSON text since the redaction works on text. A session that does not parse back is
 * left out.
 */
async function exportState(
  session: string | undefined,
  sources: IFeedbackSources,
): Promise<Record<string, unknown>> {
  const exported = await readPersistedFeedbackState(sources.persistedRows, redactSensitiveText);
  if (session !== undefined) {
    try {
      exported.session = JSON.parse(redactSensitiveText(session));
    } catch (err) {
      log("warn", "failed to export the session state for feedback", {
        error: getErrorMessageOrDefault(err),
      });
    }
    await yieldToLoop();
  }
  trimFeedbackState(exported);
  return exported;
}

/**
 * The recording as it is sent. The renderer masked, redacted and compressed it as it recorded, so
 * this only puts what main kept into one stream.
 */
async function prepareReplay(
  segments: readonly ReplaySegment[] | undefined,
): Promise<IPackedReplay | undefined> {
  if (segments === undefined) return undefined;
  try {
    return await packReplay(segments);
  } catch (err) {
    log("warn", "failed to prepare the screen recording for feedback", {
      error: getErrorMessageOrDefault(err),
    });
    return undefined;
  }
}

async function crashSummaries(sources: IFeedbackSources): Promise<IFeedbackCrashDump[]> {
  try {
    return await sources.crashSummaries();
  } catch (err) {
    log("warn", "failed to read crash dumps for feedback", {
      error: getErrorMessageOrDefault(err),
    });
    return [];
  }
}

/** Gathers and redacts everything one feedback holds. Nothing is sent here. */
export async function collectFeedbackContent(
  request: IFeedbackSendRequest,
  sources: IFeedbackSources,
): Promise<IFeedbackContent> {
  const createdAt = new Date(request.createdAt);
  const support = request.supportData;

  const [logs, crashes, state] =
    support === undefined
      ? [[], [], undefined]
      : await Promise.all([
          readRecentLogs(
            sources.userData,
            request.createdAt - support.logWindowMinutes * 60_000,
            request.createdAt,
          ),
          crashSummaries(sources),
          exportState(support.session, sources),
        ]);

  return {
    feedbackId: request.feedbackId,
    text: request.text,
    createdAt,
    platform: process.platform,
    platformVersion: os.release(),
    arch: process.arch,
    userPathHasNonAscii: hasNonAscii(sources.userData),
    game: request.game,
    nexusGameId: request.nexusGameId,
    traceIds: support === undefined ? [] : sources.traceIds(),
    logs,
    state,
    crashes,
    screenshot: request.screenshot,
    replay: request.includeReplay ? await prepareReplay(sources.replay()) : undefined,
  };
}
