/** The Steam game folder check (MOD-80): the renderer decides when it runs, main does the work. */
import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import { FlagService } from "@/FlagService";

import type { IExtensionApi, IExtensionContext } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import { flaggedGameFolderCheckConfig, gameFolderCheckConfig } from "./config";
import { GameFolderCheckScheduler } from "./scheduler";
import { canCheckSteamFolder, steamCheckInput } from "./steamInput";
import { submitGameFolderCheck } from "./submit";

export { queueGameFolderCheck } from "./scheduler";

/** Starts the scheduler; call once the store is ready. */
export function initGameFolderCheck(api: IExtensionApi): void {
  window.api.gameFolderCheck.onSubmit((result) => submitGameFolderCheck(api, result));

  const scheduler = new GameFolderCheckScheduler(api);
  api.onStateChange(["session", "base", "activity"], scheduler.tick);
  api.onStateChange(["session", "base", "toolsRunning"], scheduler.tick);
  api.onStateChange(["persistent", "analyticsTelemetry", "gameFolderChecks"], scheduler.tick);
  FlagService.instance?.subscribe(() => scheduler.tick());
  scheduler.tick();
}

/** Dev builds: runs a check now, skipping every gate, and shows the JSON report. Sends nothing. */
async function runManualCheck(api: IExtensionApi, gameId: VortexGameId): Promise<void> {
  const config = flaggedGameFolderCheckConfig() ?? gameFolderCheckConfig();
  const input = await steamCheckInput(api.getState(), gameId, config.limits, false);
  if (input === undefined) {
    api.showErrorNotification(
      "Can't check the game folder",
      "Vortex has no Steam install data for this game.",
      { allowReport: false },
    );
    return;
  }
  try {
    await window.api.gameFolderCheck.runManual(input);
  } catch (err) {
    log("warn", "manual game folder check failed", {
      gameId,
      error: getErrorMessageOrDefault(err),
    });
    api.showErrorNotification("Game folder check failed", err, { allowReport: false });
  }
}

/**
 * Dev builds: a "Check Game Folder" action on each Steam game's entry on the Games page,
 * managed or not, so a folder can be checked before Vortex touches it.
 */
export function registerGameFolderCheckAction(context: IExtensionContext): void {
  if (process.env.NODE_ENV !== "development") return;
  // the Games page passes Vortex game ids
  const isSteam = (gameIds: string[]) =>
    gameIds[0] !== undefined &&
    canCheckSteamFolder(context.api.getState(), VortexGameId(gameIds[0]));
  for (const group of ["game-managed-buttons", "game-unmanaged-buttons"]) {
    context.registerAction(
      group,
      130,
      "browse",
      {},
      "Check Game Folder",
      (gameIds: string[]) => {
        if (gameIds[0] !== undefined) void runManualCheck(context.api, VortexGameId(gameIds[0]));
      },
      isSteam,
    );
  }
}
