import type { IExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { AppExtensionInstalledEvent } from "./MixpanelEvents";

/** Where an extension install originated. */
export type ExtensionInstallSource = "nexusmods" | "github" | "manual";

/**
 * Emits app_extension_installed for a Vortex extension that finished installing. The identity comes
 * from the installed IExtension; `extra` carries the analytics-only bits that aren't on that
 * contract (install source, the supported game, and whether it replaced a prior version).
 * `extension_type` is "game" for game-support extensions, "other" for everything else.
 */
export function emitExtensionInstalled(
  api: IExtensionApi,
  ext: Pick<IExtension, "id" | "name" | "author" | "version" | "type" | "modId">,
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
      extension_id: ext.id,
      extension_name: ext.name,
      author: ext.author,
      version: ext.version,
      mod_id: ext.modId,
      extension_type: ext.type === "game" ? "game" : "other",
      game_domain: extra.gameDomain,
      game_name: extra.gameName,
      source: extra.source,
      is_update: extra.isUpdate,
    }),
  );
}
