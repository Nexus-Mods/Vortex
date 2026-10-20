import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGame } from "../types/IGame";
import { isWindowsExecutable } from "./linux/proton";

/** A Windows game running through Proton or Wine, which expects case-insensitive paths. */
export function isWindowsGame(
  game: IGame | undefined,
  discovery: IDiscoveryResult | undefined,
): boolean {
  if (process.platform === "win32" || game?.executable === undefined) {
    return false;
  }
  return isWindowsExecutable(discovery?.executable ?? game.executable(discovery?.path) ?? "");
}
