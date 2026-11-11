import type { VortexGameId } from "@vortex/shared";

import type { IGameStored } from "@/types/IState";

/**
 * The collections the game queries join over. Every query takes them as an argument, so
 * nothing here reads Redux or a module singleton.
 */
export interface IGameData {
  /** `session.gameMode.known` */
  known: readonly IGameStored[];
}

/** What to look a game up by. Every kind is its own brand, none stands in for another. */
export type GameQuery = { vortexGameId: VortexGameId };

/** Find the game for an id. `undefined` means nothing known matches. */
export function findGame(data: IGameData, query: GameQuery): IGameStored | undefined {
  return data.known.find((game) => game.id === query.vortexGameId);
}
