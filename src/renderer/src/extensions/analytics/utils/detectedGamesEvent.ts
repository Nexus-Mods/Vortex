import { getErrorMessageOrDefault } from "@vortex/shared";
import { v4 as uuid } from "uuid";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";

/** The store listings Vortex found installed, keyed by store. */
export interface StoreListings {
  steam: string[];
  gog: string[];
  epic: string[];
}

/**
 * Submits the detected-games telemetry event for the store listings found installed.
 * A no-op unless the user consented to analytics and is logged in. Fire and forget:
 * failures are logged, never thrown, so the detected-games refresh this runs beside
 * never depends on telemetry.
 */
export async function emitDetectedGamesEvent(
  api: IExtensionApi,
  listings: StoreListings,
): Promise<void> {
  const state = api.getState();
  if (!isTelemetryEnabled(state) || !isLoggedIn(state)) {
    return;
  }

  try {
    const res = await createVortexNexusV3InternalClient(api).telemetryEvent(
      uuid(),
      Temporal.Now.instant(),
      {
        type: "detected_games",
        version: 1,
        payload: listings,
      },
    );

    if (res.accepted > 0 || res.rejected.length > 0)
      log("debug", "telemetry events send", {
        accepted: res.accepted,
        rejected: res.rejected.length,
      });
  } catch (err) {
    log("warn", "detected-games: telemetry submit failed", {
      error: getErrorMessageOrDefault(err),
    });
  }
}
