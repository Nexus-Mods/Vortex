/**
 * Browse Nexus Extension
 * Provides browsing functionality for Nexus Mods collections and mods
 */

import { mdiMagnify } from "@mdi/js";

import type { IExtensionContext } from "../../types/IExtensionContext";
import { activeGameId } from "../../util/selectors";
import BrowseNexusPage from "./views/BrowseNexusPage";

function init(context: IExtensionContext): boolean {
  // Register the Browse page
  context.registerMainPage("search", "Browse Nexus Mods", BrowseNexusPage, {
    priority: 20,
    hotkey: "B",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
    }),
    mdi: mdiMagnify,
  });

  return true;
}

export default init;
