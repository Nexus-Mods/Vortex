import type { LogWindowMinutes } from "@vortex/shared";
import type { IFeedbackScreenshot, IFeedbackSendRequest } from "@vortex/shared/ipc";

import { gameData } from "@/extensions/gamemode_management/gameData";
import { convertId } from "@/extensions/gamemode_management/queries";
import { activeGameId } from "@/extensions/profile_management/selectors";
import type { IState } from "@/types/IState";
import { log } from "@/util/log";

import { scrubState } from "./prepareSupportBundle";

export interface IFeedbackInput {
  feedbackId: string;
  text: string;
  createdAt: Date;
  /** Whether logs, state and crash summaries go with the text. */
  includeSupportData: boolean;
  /** How far back the logs go. */
  logWindowMinutes: LogWindowMinutes;
  screenshot: IFeedbackScreenshot | undefined;
  /** Whether the recording main put aside as the dialog opened goes too. */
  includeReplay: boolean;
}

/**
 * The `session` hive, scrubbed of logins, as JSON text: the one hive a feedback sends that main
 * does not persist, so main can't read it for itself. Only text can carry it, since parts of it
 * (the actions of a notification) are functions. Main redacts and trims it; the two lists that are
 * the same for every user, by far the largest part of it, are left out here already, through
 * copies of the objects that hold them, never touching the store's own. Undefined when it can't be
 * stringified.
 */
function stringifySession(state: IState): string | undefined {
  const { session } = scrubState(state);
  const trimmed = {
    ...session,
    extensions: { ...session.extensions, available: undefined },
    gameMode: { ...session.gameMode, known: undefined },
  };
  try {
    return JSON.stringify(trimmed);
  } catch (err) {
    log("warn", "failed to export the session state for feedback", { error: err });
    return undefined;
  }
}

/** What only the renderer knows about a feedback; main gathers and sends the rest. */
export function buildFeedbackRequest(state: IState, input: IFeedbackInput): IFeedbackSendRequest {
  const gameId = activeGameId(state) || null;
  return {
    feedbackId: input.feedbackId,
    createdAt: input.createdAt.getTime(),
    text: input.text,
    game: gameId,
    nexusGameId:
      gameId === null
        ? null
        : (convertId(gameData(state), { vortexGameId: gameId }, "gameId") ?? null),
    // empty before the instance id is assigned, so it's left out
    instanceId: state.app.instanceId || undefined,
    supportData: input.includeSupportData
      ? { logWindowMinutes: input.logWindowMinutes, session: stringifySession(state) }
      : undefined,
    screenshot: input.screenshot,
    includeReplay: input.includeReplay,
  };
}
