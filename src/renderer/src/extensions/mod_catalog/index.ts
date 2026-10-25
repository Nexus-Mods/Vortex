/**
 * mkeiitmods: the mod catalog ("Catalog").
 *
 * Lists every Nexus Mods mod for the active game with search, category filter, sorting and
 * "load more", marks mods that are installed or have an update, and installs them through
 * the regular Nexus download and install flow. Data comes only from the official Nexus Mods
 * API (GraphQL v2 for the list, the existing client helpers for files and details).
 *
 * Kept separate from the Browse page (browse_nexus), whose "Mods" tab upstream Vortex still
 * reserves for its own work, so upstream merges don't conflict.
 */
import type { IExtensionContext } from "../../types/IExtensionContext";
import { activeGameId } from "../../util/selectors";
import { catalogSettingsReducer } from "./settings";
import ModCatalogPage from "./views/ModCatalogPage";

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "modCatalog"], catalogSettingsReducer);

  context.registerMainPage("store", "Catalog", ModCatalogPage, {
    priority: 19,
    hotkey: "K",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
    }),
    menuIcon: "store",
  });

  return true;
}

export default init;
