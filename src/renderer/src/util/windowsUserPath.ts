import { existsSync } from "node:fs";
import * as path from "node:path";

import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import { getGame } from "../extensions/gamemode_management/util/getGame";
import getVortexPath from "./getVortexPath";
import { getCompatDataPath, getWinePrefixPath } from "./linux/proton";

export type WindowsUserFolder = "documents" | "localAppData";

const PREFIX_FOLDERS: Record<WindowsUserFolder, string[]> = {
  documents: ["Documents"],
  localAppData: ["AppData", "Local"],
};

/**
 * Steam keeps a game's compatdata in the same library as the game itself, so the
 * prefix can be derived from a `<library>/steamapps/common/<game>` discovery path.
 */
function protonUserPath(
  gameId: string,
  discovery: IDiscoveryResult | undefined,
): string | undefined {
  // automatic discovery doesn't record the app id, only a manually set location does
  const game = gameId !== undefined ? getGame(gameId) : undefined;
  const appId =
    discovery?.environment?.SteamAPPId ??
    game?.environment?.SteamAPPId ??
    game?.details?.steamAppId?.toString();
  if (process.platform === "win32" || discovery?.path === undefined || !appId) {
    return undefined;
  }
  const commonPath = path.dirname(discovery.path);
  if (path.basename(commonPath).toLowerCase() !== "common") {
    return undefined;
  }
  const prefix = getWinePrefixPath(getCompatDataPath(path.dirname(commonPath), appId));
  const userPath = path.join(prefix, "drive_c", "users", "steamuser");
  return existsSync(userPath) ? userPath : undefined;
}

/**
 * The Windows user folder a game reads from: inside its Proton
 * prefix under Proton, the current user's folder otherwise.
 */
export function windowsUserPath(
  folder: WindowsUserFolder,
  gameId: string,
  discovery: IDiscoveryResult | undefined,
): string {
  const userPath = protonUserPath(gameId, discovery);
  if (userPath === undefined) {
    return getVortexPath(folder);
  }
  return path.join(userPath, ...PREFIX_FOLDERS[folder]);
}
