import { type GameId } from "@vortex/shared";

import type { IState } from "@/types/IState";

import { catalogExtensionGameIds } from "../selectors";
import { isTierZeroCandidate } from "../util/detected_games/listableDetectedIds";
import { Tiers, type Tier } from "./types";

/**
 * What tier of support the game has. Tier 2 is a game a (normal) extension provides
 * for; Tier 0 is a game managed without an extension, either already opted in or an
 * extension-less detected game no catalog extension covers, where Manage means the
 * opt-in. undefined when nothing supports the game.
 */
export function supportTier(state: IState, gameId: GameId): Tier | undefined {
  if (state.persistent.gameMode?.tier0[gameId] !== undefined) {
    return Tiers.tier0;
  }

  const detected = (state.session.gameMode?.detectedGames ?? []).find(
    (iter) => iter.gameId === gameId,
  );

  if (detected !== undefined) {
    if (detected.extension !== undefined) {
      return Tiers.tier2;
    }

    return isTierZeroCandidate(detected, catalogExtensionGameIds(state)) ? Tiers.tier0 : undefined;
  }

  // no detected entry: catalog coverage is the normal kind of support, everything
  // else is unsupported
  return catalogExtensionGameIds(state).has(gameId) ? Tiers.tier2 : undefined;
}
