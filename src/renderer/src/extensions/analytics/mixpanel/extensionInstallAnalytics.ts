import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IExtensionState } from "@/types/IState";

import { AppExtensionInstalledEvent } from "./MixpanelEvents";

/** Where an extension install originated. */
export type ExtensionInstallSource = "nexusmods" | "manual";

/**
 * Emits app_extension_installed for a Vortex extension that finished installing. The identity comes
 * from the installed IExtension; `extra` carries the analytics-only bits that aren't on that
 * contract (install source, the supported game, and whether it replaced a prior version).
 * `extension_type` is "game" for game-support extensions, "other" for everything else.
 */
export function emitExtensionInstalled(
  api: IExtensionApi,
  state: IExtensionState,
  extra: {
    source: ExtensionInstallSource;
    isUpdate: boolean;
    gameDomain?: string;
    gameName?: string;
  },
): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppExtensionInstalledEvent({
      extension_name: state.name,
      version: state.version,
      extension_type: state.type === "game" ? "game" : "other",
      source: extra.source,
      is_update: extra.isUpdate,

      mod_id: state.modId,
      file_id: state.fileId,
      game_domain: extra.gameDomain,
      game_name: extra.gameName,
    }),
  );
}
