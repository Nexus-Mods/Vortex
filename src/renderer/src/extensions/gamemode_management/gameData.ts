import { createSelector } from "reselect";

import type { IState } from "@/types/IState";

import { nexusGames } from "../nexus_integration/util";
import type { IGameData } from "./queries";
import { knownGames } from "./selectors";

/**
 * The collections `findGame` and `convertId` join over, assembled from the state and the
 * Nexus Mods games list. The result is only replaced when one of the three is, so it can
 * be used as a dependency of other selectors and hooks.
 *
 * The games list is a module-level cache and not part of the state, it is empty until it
 * has loaded.
 */
export const gameData = createSelector(
  knownGames,
  (state: IState) => state.persistent.gameMode.tier0,
  () => nexusGames(),
  (known, tier0, games): IGameData => ({ known, tier0, nexusGames: games }),
);
