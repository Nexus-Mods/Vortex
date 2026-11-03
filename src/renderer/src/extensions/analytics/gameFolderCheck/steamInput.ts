import path from "node:path";

import type { VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput, GameFolderCheckLimits } from "@vortex/shared/ipc";

import type { IState } from "../../../types/IState";
import type { ISteamEntry } from "../../../util/Steam";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { detectedInternalId } from "../../gamemode_management/util/detected_games/detectedInternalId";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { numericGameIdToDomainName } from "../../nexus_integration/util";
import { normPath } from "../utils/normPath";

export function isSteamGame(state: IState, gameId: VortexGameId): boolean {
  const discovery = discoveryByGame(state, gameId);
  return discovery?.path !== undefined && discovery.store === "steam";
}

/** Steam app ids the detected-games response matched for a game, by the id its card uses. */
function detectedSteamAppIds(state: IState, gameId: VortexGameId): string[] {
  const { known, detectedGames } = state.session.gameMode;
  const discovered = state.settings.gameMode.discovered;
  return detectedGames.flatMap((game) => {
    const domain = numericGameIdToDomainName(game.gameId);
    return domain !== undefined && detectedInternalId(known, discovered, domain) === gameId
      ? game.storeIDs.steam
      : [];
  });
}

/**
 * The Steam scan's entry for a game: by app id first, because the depots belong to Steam's own
 * install folder, which can differ from where Vortex deploys; then by path. A game Vortex
 * hasn't discovered (no extension installed yet) is matched by the app ids the detected-games
 * response found for it.
 */
export function steamEntryFor(state: IState, gameId: VortexGameId): ISteamEntry | undefined {
  const discovery = discoveryByGame(state, gameId);
  const entries = (getGameStoresSafe()
    .find((store) => store.id === "steam")
    ?.snapshot().entries ?? []) as ISteamEntry[];
  const appId = getGame(gameId)?.details?.steamAppId;
  const byAppId =
    appId !== undefined ? entries.find((iter) => iter.appid === String(appId)) : undefined;
  if (discovery?.path === undefined) {
    const detected = new Set(detectedSteamAppIds(state, gameId));
    return byAppId ?? entries.find((iter) => detected.has(iter.appid));
  }
  return (
    byAppId ??
    entries.find(
      (iter) => iter.gamePath !== undefined && normPath(iter.gamePath) === normPath(discovery.path),
    )
  );
}

/**
 * Whether a game's folder can be checked by hand: Steam has install data for it, and Vortex
 * either discovered it through Steam or hasn't discovered it at all.
 */
export function canCheckSteamFolder(state: IState, gameId: VortexGameId): boolean {
  const discovery = discoveryByGame(state, gameId);
  if (discovery?.path !== undefined && discovery.store !== "steam") return false;
  const entry = steamEntryFor(state, gameId);
  return entry?.gamePath !== undefined && entry.installData !== undefined;
}

/** Main's input for checking a game's Steam folder, or undefined if it can't be checked. */
export async function steamCheckInput(
  state: IState,
  gameId: VortexGameId,
  limits: GameFolderCheckLimits,
  fullVerify: boolean,
): Promise<GameFolderCheckInput | undefined> {
  if (!canCheckSteamFolder(state, gameId)) return undefined;
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
