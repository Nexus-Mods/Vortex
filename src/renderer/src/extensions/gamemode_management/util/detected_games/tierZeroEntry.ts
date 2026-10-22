import { GameDomain, type VortexGameId } from "@vortex/shared";

import { nexusGames, numericGameIdToDomainName } from "@/extensions/nexus_integration/util";
import type { ITierZeroGame } from "@/types/IState";
import type { IState } from "@/types/IState";

import { catalogExtensionGameIds } from "../../selectors";
import { isTierZeroCandidate } from "./listableDetectedIds";

/**
 * The entry a Manage on an extension-less detected game would persist as a Tier 0 game:
 * managed under its nexus domain, discovered through the store listings the endpoint
 * matched it with. undefined when Manage means the extension-download flow instead,
 * because Vortex already knows the game, the endpoint returned an extension for it, or
 * an extension in the catalog provides one.
 */
export function tierZeroEntry(state: IState, gameId: VortexGameId): ITierZeroGame | undefined {
  if ((state.session.gameMode?.known ?? []).some((game) => game.id === gameId)) {
    return undefined;
  }

  for (const detected of state.session.gameMode?.detectedGames ?? []) {
    const domain = numericGameIdToDomainName(detected.gameId);
    if (domain === undefined || domain.toLowerCase() !== gameId.toLowerCase()) {
      continue;
    }
    if (!isTierZeroCandidate(detected, catalogExtensionGameIds(state))) {
      return undefined;
    }

    const nexusGame = nexusGames().find((game) => game.id === detected.gameId);
    return {
      gameId: detected.gameId,
      domain: GameDomain(domain.toLowerCase()),
      name: nexusGame?.name ?? gameId,
      storeIDs: detected.storeIDs,
    };
  }

  return undefined;
}
