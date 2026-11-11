import { VortexGameId, type GameDomain } from "@vortex/shared";

import type { IGameStored } from "@/types/IState";

import type { IDiscoveryResult } from "./types/IDiscoveryResult";

/**
 * The collections the game queries join over. Every query takes them as an argument, so
 * nothing here reads Redux or a module singleton.
 */
export interface IGameData {
  /** `session.gameMode.known` */
  known: readonly IGameStored[];
}

/** What to look a game up by. Every kind is its own brand, none stands in for another. */
export type GameQuery =
  | { vortexGameId: VortexGameId }
  | {
      gameDomain: GameDomain;

      /** Several games can share a domain. With the discovery results the one that is installed is preferred. */
      discovered?: Readonly<Record<VortexGameId, IDiscoveryResult>>;
    };

/**
 * Find the game for an id. `undefined` means nothing known matches.
 *
 * A domain is the game's `details.nexusPageId`, the only place a game says which Nexus Mods
 * page it belongs to. A game without one has no domain and is never found by it.
 */
export function findGame(data: IGameData, query: GameQuery): IGameStored | undefined {
  if ("vortexGameId" in query) {
    return data.known.find((game) => game.id === query.vortexGameId);
  } else if ("gameDomain" in query) {
    const matches = data.known.filter((game) => game.details?.nexusPageId === query.gameDomain);
    const installed = matches.find(
      (game) => query.discovered?.[VortexGameId(game.id)]?.path !== undefined,
    );

    return installed ?? matches[0];
  } else {
    const _exhausted: never = query;
    return undefined;
  }
}
