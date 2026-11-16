import type { TelemetryEvent } from "@vortex/nexus-api-v3";
import type { GameFolderCheckResult } from "@vortex/shared/ipc";
import { v4 as uuid } from "uuid";

import { setGameFolderCheckMarker } from "@/extensions/analytics/actions/telemetry.action";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import { flaggedGameFolderCheckConfig, gameFolderCheckConfig, MAX_BATCH_BYTES } from "./config";
import { toBatches, toGameFolderStateEvents } from "./payload";
import { gameFolderCheckMarkers } from "./scheduler";
import { steamEntryFor } from "./steamInput";

/**
 * Sends a finished check and marks the game done: its game_folder_state_files events, then one
 * game_folder_state event, in as many batches as their size needs. Throws when a send fails or
 * any event is rejected, so the check stays pending and runs again as a new check.
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

  const { maxFileParts, maxEventBytes } = flaggedGameFolderCheckConfig() ?? gameFolderCheckConfig();
  const { state: statePayload, fileParts } = toGameFolderStateEvents(result, {
    nexusGameId,
    managedAt: marker.managedAt,
    steamLastUpdated: steamEntryFor(state, gameId)?.lastUpdated?.getTime() ?? null,
    checkId: uuid(),
    maxFileParts,
    maxEventBytes,
  });
  // the state event goes last: a check that fails part-way then leaves only file events behind,
  // which no query counts, and never a state event that the next run's would duplicate
  const events: TelemetryEvent[] = [
    ...fileParts.map(
      (payload): TelemetryEvent => ({ type: "game_folder_state_files", version: 1, payload }),
    ),
    { type: "game_folder_state", version: 1, payload: statePayload },
  ];
  const date = Temporal.Now.instant();
  const client = createVortexNexusV3InternalClient(api);
  for (const batch of toBatches(events, MAX_BATCH_BYTES)) {
    const response = await client.telemetryEvents(
      batch.map((event) => ({ id: uuid(), date, event })),
    );
    if (response.rejected.length > 0) {
      throw new Error("game_folder_state events rejected");
    }
  }
  api.store.dispatch(
    setGameFolderCheckMarker({
      gameId,
      marker: { state: "done", status: result.status, at: Date.now() },
    }),
  );
}
