import type { GameDomain } from "@vortex/shared";
import { VortexGameId } from "@vortex/shared";

import type { IGameStored } from "@/types/IState";

import { convertGameIdReverse } from "../../../nexus_integration/util/convertGameId";
import type { IDiscoveryResult } from "../../types/IDiscoveryResult";

/**
 * The internal id for a detected game, from its Nexus domain. Several known games can share
 * a domain (Neverwinter Nights and its Enhanced Edition, Skyrim SE and VR), and
 * `convertGameIdReverse` takes the first registered, which needn't be the one installed.
 * Taking the one discovery found instead puts the response's card on the game the user has,
 * so the detected section doesn't list that game again from discovery.
 *
 * undefined when no known game matches the domain, for the caller to decide what id the game
 * will get.
 */
export function detectedInternalId(
  knownGames: IGameStored[],
  discovered: Record<VortexGameId, IDiscoveryResult>,
  domain: GameDomain,
): VortexGameId | undefined {
  const lowered = domain.toLowerCase();
  const matches = (game: IGameStored) =>
    game.id === lowered || game.details?.nexusPageId === domain;
  const installed = knownGames.filter(
    (game) => matches(game) && discovered[VortexGameId(game.id)]?.path !== undefined,
  );

  const installedId = installed.find((game) => game.id === lowered)?.id ?? installed[0]?.id;
  if (installedId !== undefined) {
    return VortexGameId(installedId);
  }

  return knownGames.some(matches) ? convertGameIdReverse(knownGames, domain) : undefined;
}
