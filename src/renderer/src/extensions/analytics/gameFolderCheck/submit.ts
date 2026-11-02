import { GameId } from "@vortex/shared";
import type { GameFolderCheckResult } from "@vortex/shared/ipc";
import { v4 as uuid } from "uuid";

import { setGameFolderCheckMarker } from "@/extensions/analytics/actions/telemetry.action";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import { toGameFolderStatePayload } from "./payload";
import { gameFolderCheckMarkers } from "./scheduler";
import { steamEntryFor } from "./steamInput";

/**
 * Sends a finished check as a game_folder_state event and marks the game done. Throws when the
 * send fails, so the check stays pending.
 */
export async function submitGameFolderCheck(
  api: IExtensionApi,
  result: GameFolderCheckResult,
): Promise<void> {
  const { gameId } = result.input;
  const state = api.getState();
  const marker = gameFolderCheckMarkers(state)[gameId];
  const nexusGameId = numericNexusGameId(gameId);
  if (marker?.state !== "pending" || nexusGameId === null) return;

  const payload = toGameFolderStatePayload(result, {
    // the numeric id from the Nexus games list
    nexusGameId: GameId(nexusGameId),
    managedAt: marker.managedAt,
    steamLastUpdated: steamEntryFor(state, gameId)?.lastUpdated?.getTime() ?? null,
  });
  const response = await createVortexNexusV3InternalClient(api).telemetryEvent(
    uuid(),
    Temporal.Now.instant(),
    { type: "game_folder_state", version: 1, payload },
  );
  if (response.rejected.length > 0) {
    throw new Error("game_folder_state event rejected");
  }
  api.store.dispatch(
    setGameFolderCheckMarker({
      gameId,
      marker: { state: "done", status: result.status, at: Date.now() },
    }),
  );
}
