/**
 * Browse Nexus Extension
 * Provides browsing functionality for Nexus Mods collections and mods
 */

import { activeGameId } from "../../util/selectors";
import type { IExtensionContext } from "../../types/IExtensionContext";
import BrowseNexusPage from "./views/BrowseNexusPage";
import { mdiMagnify } from "@mdi/js";

function init(context: IExtensionContext): boolean {
  // Register the Browse page
  context.registerMainPage("search", "Browse Nexus Mods", BrowseNexusPage, {
    priority: 60,
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
