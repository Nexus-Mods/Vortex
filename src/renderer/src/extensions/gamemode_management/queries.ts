import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameDomain, VortexError, VortexGameId, type GameId } from "@vortex/shared";

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
    const unhandled: never = query;
    throw new VortexError(`Unhandled game query: ${JSON.stringify(unhandled)}`, {
      kind: "argument-invalid",
      argument: "query",
    });
  }
}

/**
 * Convert an id to the id of a registered game. `undefined` means no known game matches,
 * the answer is never a guess at the id an extension might register one under.
 *
 * Converting an id to its own kind is a type error, there is nothing to look up.
 */
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { vortexGameId: VortexGameId }>,
  to: "vortexGameId",
): VortexGameId | undefined {
  const game = findGame(data, query);
  return game === undefined ? undefined : VortexGameId(game.id);
}
