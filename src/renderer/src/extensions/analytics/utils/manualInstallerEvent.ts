import type { EventManualInstaller } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import type { VortexGameId } from "@vortex/shared";
import { v4 as uuid } from "uuid";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import type { IModReference } from "../../mod_management/types/IMod";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/** the destination's max length; the backend rejects longer values */
const MAX_DESTINATION_LENGTH = 256;

export interface ManualInstallerEventContext {
  /** the internally managed game id of the game the mod installed into */
  gameId: VortexGameId;
  /** the folder the mod installed to, relative to the game root: "" is the game
   *  root, and the separators are the platform's */
  destination: string;
  /** the nexus ids of the mod file, when the archive comes from Nexus Mods */
  modReference: IModReference | undefined;
}

/**
 * The event's destination for a Vortex staging-relative folder: forward slashes with a
 * leading and a trailing one, the empty folder being the game root. Values longer than
 * 256 characters are truncated, which drops the trailing slash and is how a truncated
 * value is told apart.
 */
export function buildTelemetryDestination(folder: string): string {
  const segments = folder
    .replace(/[\\/]+/g, "/")
    .split("/")
    .filter((segment) => segment !== "");
  return `/${segments.join("/")}${segments.length > 0 ? "/" : ""}`.slice(0, MAX_DESTINATION_LENGTH);
}

/** the event only allows ids from 1, and anything else means the string held no Nexus id */
const toNexusId = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = parseInt(value, 10);
  return parsed > 0 ? parsed : null;
};

const nexusIdsOf = (modReference: IModReference | undefined) => {
  // a file id is only ever reported together with a mod id, like the nexus uids do
  const modId = toNexusId(modReference?.repo?.modId);
  return {
    mod_id: modId,
    file_id: modId === null ? null : toNexusId(modReference?.repo?.fileId),
  };
};

/**
 * Submits the manual_installer telemetry event for a Manual Installer destination. A no-op
 * unless the user picked the folder in the dialog, consented to analytics and is logged in.
 * Fire and forget: failures are logged, never thrown, so the install this runs beside
 * never depends on telemetry.
 */
export async function emitManualInstallerEvent(
  api: IExtensionApi,
  context: ManualInstallerEventContext,
): Promise<void> {
  const state = api.getState();
  if (!isTelemetryEnabled(state) || !isLoggedIn(state)) {
    return;
  }

  try {
    const gameId = numericNexusGameId(context.gameId);
    if (gameId === null) {
      log("debug", "manual-installer: nexus game id unresolvable", { gameId: context.gameId });
      return;
    }

    const destination = buildTelemetryDestination(context.destination);
    const event: EventManualInstaller = {
      type: "manual_installer",
      version: 1,
      payload: {
        destination,
        game_id: gameId,
        ...nexusIdsOf(context.modReference),
      },
    };

    const res = await createVortexNexusV3InternalClient(api).telemetryEvent(
      uuid(),
      Temporal.Now.instant(),
      event,
    );

    if (res.accepted > 0 || res.rejected.length > 0) {
      log("debug", "manual-installer: telemetry event sent", {
        accepted: res.accepted,
        rejected: res.rejected.length,
      });
    }
  } catch (err) {
    log("warn", "manual-installer: telemetry submit failed", {
      error: getErrorMessageOrDefault(err),
    });
  }
}
