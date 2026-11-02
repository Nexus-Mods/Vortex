import path from "node:path";

import type { VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput, GameFolderCheckLimits } from "@vortex/shared/ipc";

import type { IState } from "../../../types/IState";
import type { ISteamEntry } from "../../../util/Steam";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { normPath } from "../utils/normPath";

export function isSteamGame(state: IState, gameId: VortexGameId): boolean {
  const discovery = discoveryByGame(state, gameId);
  return discovery?.path !== undefined && discovery.store === "steam";
}

/**
 * The Steam scan's entry for a game: by app id first, because the depots belong to Steam's own
 * install folder, which can differ from where Vortex deploys; then by path.
 */
export function steamEntryFor(state: IState, gameId: VortexGameId): ISteamEntry | undefined {
  const discovery = discoveryByGame(state, gameId);
  const entries = (getGameStoresSafe()
    .find((store) => store.id === "steam")
    ?.snapshot().entries ?? []) as ISteamEntry[];
  const appId = getGame(gameId)?.details?.steamAppId;
  return (
    (appId !== undefined ? entries.find((iter) => iter.appid === String(appId)) : undefined) ??
    (discovery?.path !== undefined
      ? entries.find(
          (iter) =>
            iter.gamePath !== undefined && normPath(iter.gamePath) === normPath(discovery.path),
        )
      : undefined)
  );
}

/** Main's input for checking a game's Steam folder, or undefined if it can't be checked. */
export async function steamCheckInput(
  state: IState,
  gameId: VortexGameId,
  limits: GameFolderCheckLimits,
  fullVerify: boolean,
): Promise<GameFolderCheckInput | undefined> {
  if (!isSteamGame(state, gameId)) return undefined;
  const entry = steamEntryFor(state, gameId);
  const data = entry?.installData;
  if (entry?.gamePath === undefined || data === undefined) return undefined;

  const steamExe = await getGameStoresSafe()
    .find((store) => store.id === "steam")
    ?.getGameStorePath();
  if (steamExe === undefined) return undefined;

  return {
    gameId,
    appId: data.appId,
    buildId: data.buildId,
    targetBuildId: data.targetBuildId,
    steamPath: path.dirname(steamExe),
    gamePath: entry.gamePath,
    // shared redistributable depots are listed separately and left out
    depots: data.depots.map(({ depotId, manifestId }) => ({ depotId, manifestId })),
    fullVerify,
    limits,
  };
}
