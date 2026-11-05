import type { VortexModId } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { sanitizeCSSId } from "@/util/util";

import { focusModsTableMod } from "../../actions/session";

/** How long the classic table takes to mount once the Mods page opens, as Health Check waits. */
const CLASSIC_TABLE_DELAY_MS = 2000;

/**
 * Opens the Mods page on a mod: the new table scrolls to it and selects it, as the collections
 * page asks it to show a group; the classic one, which the new table's request can't reach, is
 * scrolled to the mod's row and highlights it once it has mounted.
 */
export const showModOnModsPage = (api: IExtensionApi, modId: VortexModId) => {
  const { settings } = api.getState();

  if (settings.mods?.betaTable === true && (settings.window.useModernLayout ?? true)) {
    api.store.dispatch(focusModsTableMod(modId));
    api.events.emit("show-main-page", "Mods");
    return;
  }

  api.events.emit("show-main-page", "Mods");
  setTimeout(() => {
    api.events.emit("mods-scroll-to", modId);
    api.highlightControl(`.${sanitizeCSSId(modId)}`, 5000);
  }, CLASSIC_TABLE_DELAY_MS);
};
