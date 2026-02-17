/**
 * Browse Nexus Extension
 * Provides browsing functionality for Nexus Mods collections and mods
 */

import { activeGameId } from "../../renderer/util/selectors";
import type { IExtensionContext } from "../../renderer/types/IExtensionContext";
import BrowseNexusPage from "./views/BrowseNexusPage";

function init(context: IExtensionContext): boolean {
  // Register the Browse page
  context.registerMainPage("search", "Browse Nexus Mods", BrowseNexusPage, {
    priority: 0, // Force top of game section
    hotkey: "B",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
    }),
  });

  return true;
}

export default init;
