import { type GameId } from "@vortex/shared";

import type { IState } from "@/types/IState";

import { numericGameIdToDomainName } from "../../nexus_integration/util";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import { catalogExtensionGameIds } from "../selectors";
import { Tiers, type Tier } from "./types";

/**
 * What tier of support the game has. Tier 2 is a game an extension provides
 * for; Tier 0 is a game managed without an extension, either already opted in or an
 * extension-less detected game no catalog extension covers, where Manage means the
 * opt-in.
 */
export function supportTier(state: IState, gameId: GameId): Tier {
  if (state.persistent.gameMode?.tier0[gameId] !== undefined) {
    return Tiers.tier0;
  }

  const domain = numericGameIdToDomainName(gameId);
  if (domain !== undefined) {
    // a game Vortex knows is handled by its installed extension, whatever the
    // endpoint says (it leaves out the bundled ones)
    if ((state.session.gameMode?.known ?? []).some((game) => nexusGameId(game) === domain)) {
      return Tiers.tier2;
    }

    const detected = (state.session.gameMode?.detectedGames ?? []).find(
      (iter) => iter.gameId === gameId,
    );

    if (detected !== undefined) {
      return detected.extension !== undefined ? Tiers.tier2 : Tiers.tier0;
    }
  }

  // no detected entry: catalog coverage is the normal kind of support, everything
  // else is tier zero.
  return catalogExtensionGameIds(state).has(gameId) ? Tiers.tier2 : Tiers.tier0;
}
