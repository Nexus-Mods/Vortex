/**
 * Dev-only PoC: a "Game folder" page that shows which files in a Steam game's folder came from
 * Steam, which from Vortex, and which from neither. Only registers in development.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */

import type { IExtensionContext } from "@/types/IExtensionContext";

import { activeGameId } from "../profile_management/selectors";
import FolderCheckPage from "./views/FolderCheckPage";

function init(context: IExtensionContext): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  context.registerMainPage("folder-check", "Game folder", FolderCheckPage, {
    priority: 70,
    group: "per-game",
    newLayout: true,
    menuIcon: "folder_open",
    visible: () => activeGameId(context.api.getState()) !== undefined,
  });

  return true;
}

export default init;
