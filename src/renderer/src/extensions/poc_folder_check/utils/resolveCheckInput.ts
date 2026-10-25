import type { FolderCheckInput } from "@vortex/shared/ipc";

import type { ISteamEntry } from "@/util/Steam";

import { normPath } from "../../analytics/utils/storeGameVersionEvent";

export type CheckInputResult =
  | { ok: true; input: FolderCheckInput; discoveryPath: string }
  | { ok: false; reason: string };

/**
 * What main needs to check the game's Steam folder, from the Steam store entry. Matches by app id
 * first, because depot paths are relative to Steam's install folder, not Vortex's discovery path.
 */
export function resolveCheckInput(args: {
  discoveryPath: string | undefined;
  steamAppId: number | string | undefined;
  steamEntries: ISteamEntry[];
  steamExePath: string | undefined;
}): CheckInputResult {
  const { discoveryPath, steamAppId, steamEntries, steamExePath } = args;
  const entry =
    (steamAppId !== undefined
      ? steamEntries.find((iter) => iter.appid === String(steamAppId))
      : undefined) ??
    (discoveryPath !== undefined
      ? steamEntries.find((iter) => normPath(iter.gamePath) === normPath(discoveryPath))
      : undefined);

  if (entry === undefined) {
    return { ok: false, reason: "This check only works for Steam games so far." };
  }
  if (entry.installData === undefined) {
    return { ok: false, reason: "Steam's install details for this game couldn't be read." };
  }
  if (steamExePath === undefined) {
    return { ok: false, reason: "Vortex couldn't find the Steam install." };
  }

  return {
    ok: true,
    discoveryPath: discoveryPath ?? entry.gamePath,
    input: {
      appId: entry.installData.appId,
      buildId: entry.installData.buildId,
      // strip the file name; not path.dirname, so it works the same on any test platform
      steamPath: steamExePath.replace(/[\\/][^\\/]*$/, ""),
      gamePath: entry.gamePath,
      depots: entry.installData.depots.map(({ depotId, manifestId }) => ({ depotId, manifestId })),
    },
  };
}
