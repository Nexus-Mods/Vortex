import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { makeModAndFileUIDs } from "../nexus_integration/util/UIDs";
import type { IModReference } from "./types/IMod";

export type ManualInstallerOutcome = "completed" | "cancelled";

/**
 * The mod and file uids of the archive being installed, from the nexus ids on its mod reference.
 * Both are undefined when the archive doesn't come from Nexus Mods, and a file uid is only
 * reported together with a mod uid.
 */
export function manualInstallerUIDs(
  vortexGameId: string,
  modReference: IModReference | undefined,
): { mod_uid?: string; file_uid?: string } {
  const modId = modReference?.repo?.modId;
  const fileId = modReference?.repo?.fileId;
  if (modId === undefined || fileId === undefined) {
    return {};
  }
  const { modUID, fileUID } = makeModAndFileUIDs(vortexGameId, modId, fileId);
  return modUID === undefined ? {} : { mod_uid: modUID, file_uid: fileUID };
}

/**
 * Analytics for the Manual Installer. game_id is a global super property, so it is not sent here.
 * Consent gating is handled centrally by the analytics extension.
 */
export const createManualInstallerTracker = (api: IExtensionApi) => ({
  trackClosed: (props: {
    outcome: ManualInstallerOutcome;
    mod_uid?: string;
    file_uid?: string;
  }) => {
    const event: MixpanelEvent = {
      eventName: "app_manual_installer_closed",
      properties: Object.fromEntries(
        Object.entries(props).filter(([, value]) => value !== undefined),
      ),
    };
    api.events.emit("analytics-track-mixpanel-event", event);
  },
});
