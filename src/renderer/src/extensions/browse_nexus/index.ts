/**
 * Browse Nexus Extension
 * Provides browsing functionality for Nexus Mods collections and mods
 */

import type { IExtensionContext } from "@/types/IExtensionContext";

import { activeGameId } from "../../util/selectors";
import { modBrowsingReducer } from "./reducers/mod_browsing/modBrowsing";
import { browseModsViewsReducer } from "./reducers/mods_views/modsViews";
import { sessionReducer } from "./reducers/session";
import BrowsePage from "./views/browse_page/BrowsePage";

function init(context: IExtensionContext): boolean {
  context.registerReducer(["session", "browse"], sessionReducer);
  context.registerReducer(["settings", "browseModsViews"], browseModsViewsReducer);
  context.registerReducer(["persistent", "modBrowsing"], modBrowsingReducer);

  context.registerMainPage("search", "Browse", BrowsePage, {
    priority: 0,
    hotkey: "B",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
    }),
    menuIcon: "manage_search",
    newLayout: true,
    isTranslucent: true,
  });

  return true;
}

export default init;
