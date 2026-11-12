import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameDomain, GameId, VortexError, VortexGameId } from "@vortex/shared";

import type { IGameStored, ITierZeroGame } from "@/types/IState";

import { tierZeroGameId } from "./tiered/tierZeroGameId";
import type { IDiscoveryResult } from "./types/IDiscoveryResult";

/**
 * The collections the game queries join over. Every query takes them as an argument, so
 * nothing here reads Redux or a module singleton.
 */
export interface IGameData {
  /** `session.gameMode.known` */
  known: readonly IGameStored[];

  /** `persistent.gameMode.tier0` */
  tier0: Readonly<Record<GameId, ITierZeroGame>>;

  /** The Nexus Mods games list, which links every `GameId` to its domain */
  nexusGames: readonly IGameListEntry[];
}

/**
 * Several games can share a domain. With the discovery results the one that is installed is
 * preferred.
 */
type Discovered = { discovered?: Readonly<Record<VortexGameId, IDiscoveryResult>> };

/** What to look a game up by. Every kind is its own brand, none stands in for another. */
export type GameQuery =
  | { vortexGameId: VortexGameId }
  | ({ gameDomain: GameDomain } & Discovered)
  | ({ gameId: GameId } & Discovered);

/**
 * Find the game for an id. `undefined` means nothing known matches.
 *
 * A domain is the game's `details.nexusPageId`, the only place a game says which Nexus Mods
 * page it belongs to. A game without one has no domain and is never found by it.
 *
 * A `GameId` is joined to a game through the Tier 0 entry that was managed under it, else
 * through the domain the Nexus Mods games list gives it.
 */
export function findGame(data: IGameData, query: GameQuery): IGameStored | undefined {
  if ("vortexGameId" in query) {
    return data.known.find((game) => game.id === query.vortexGameId);
  } else if ("gameDomain" in query) {
    const { gameDomain, discovered } = query;

    const matches = data.known.filter((game) => game.details?.nexusPageId === gameDomain);
    const installed = matches.find(
      (game) => discovered?.[VortexGameId(game.id)]?.path !== undefined,
    );

    return installed ?? matches[0];
  } else if ("gameId" in query) {
    const { gameId, discovered } = query;

    const tierZero =
      data.tier0[gameId] !== undefined
        ? findGame(data, { vortexGameId: tierZeroGameId(gameId) })
        : undefined;

    if (tierZero !== undefined) {
      return tierZero;
    }

    const listed = data.nexusGames.find((entry) => entry.id === gameId);
    return listed === undefined
      ? undefined
      : findGame(data, { gameDomain: GameDomain(listed.domain_name), discovered });
  } else {
    return unsupportedQuery(query);
  }
}

/**
 * The Nexus Mods game a game is for, `undefined` when nothing known says. A Tier 0 game
 * carries its own entry. Otherwise `declared`, the domain the game says it belongs to, is
 * looked up in the Nexus Mods games list, which is empty until it has loaded.
 *
 * `declared` is passed in because this is also asked while the game is being stored, when
 * it isn't in `data.known` yet.
 */
export function nexusGameData(
  data: IGameData,
  vortexGameId: VortexGameId,
  declared?: GameDomain,
): { gameId: GameId; gameDomain: GameDomain } | undefined {
  const tierZero = Object.values(data.tier0).find(
    (entry) => tierZeroGameId(entry.gameId) === vortexGameId,
  );
  if (tierZero !== undefined) {
    return { gameId: tierZero.gameId, gameDomain: tierZero.domain };
  }

  if (declared === undefined) {
    return undefined;
  }

  const listed = data.nexusGames.find((entry) => entry.domain_name === declared);
  return listed === undefined ? undefined : { gameId: GameId(listed.id), gameDomain: declared };
}

function unsupportedQuery(query: unknown): never {
  throw new VortexError(`Unhandled game query: ${JSON.stringify(query)}`, {
    kind: "argument-invalid",
    argument: "query",
  });
}

/**
 * Convert an id to the id of another kind. `undefined` means nothing known matches, the
 * answer is never a guess.
 *
 * - `vortexGameId` is the id of a registered game, so it is `findGame`'s game.
 * - `gameDomain` is a fact the data holds without a registered game: the game's
 *   `details.nexusPageId`, or for a `GameId` the Tier 0 entry managed under it, else the
 *   Nexus Mods games list.
 * - `gameId` goes through the domain, to the Tier 0 entry managed under it, else the Nexus
 *   Mods games list.
 *
 * Converting an id to its own kind is a type error, there is nothing to look up.
 */
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { vortexGameId: VortexGameId }>,
  to: "vortexGameId",
): VortexGameId | undefined;
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { gameDomain: GameDomain }>,
  to: "gameDomain",
): GameDomain | undefined;
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { gameId: GameId }>,
  to: "gameId",
): GameId | undefined;
export function convertId(
  data: IGameData,
  query: GameQuery,
  to: "vortexGameId" | "gameDomain" | "gameId",
): VortexGameId | GameDomain | GameId | undefined {
  if (to === "vortexGameId") {
    const game = findGame(data, query);
    return game === undefined ? undefined : VortexGameId(game.id);
  }

  if (to === "gameId") {
    let gameDomain: GameDomain | undefined;
    if ("vortexGameId" in query) {
      gameDomain = convertId(data, query, "gameDomain");
    } else if ("gameDomain" in query) {
      gameDomain = query.gameDomain;
    } else {
      return unsupportedQuery(query);
    }

    if (gameDomain === undefined) {
      return undefined;
    }

    const tierZero = Object.values(data.tier0).find((entry) => entry.domain === gameDomain);
    if (tierZero !== undefined) {
      return tierZero.gameId;
    }

    const listed = data.nexusGames.find((entry) => entry.domain_name === gameDomain);
    return listed === undefined ? undefined : GameId(listed.id);
  }

  if ("vortexGameId" in query) {
    const nexusPageId: unknown = findGame(data, query)?.details?.nexusPageId;
    return typeof nexusPageId === "string" && nexusPageId !== ""
      ? GameDomain(nexusPageId)
      : undefined;
  } else if ("gameId" in query) {
    const tierZero = data.tier0[query.gameId];
    if (tierZero !== undefined) {
      return tierZero.domain;
    }

    const listed = data.nexusGames.find((entry) => entry.id === query.gameId);
    return listed === undefined ? undefined : GameDomain(listed.domain_name);
  } else {
    return unsupportedQuery(query);
  }
}
