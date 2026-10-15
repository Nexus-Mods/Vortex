import type { IGameStored } from "@/types/IState";

import { convertGameIdReverse } from "../../../nexus_integration/util/convertGameId";
import type { IDiscoveryResult } from "../../types/IDiscoveryResult";

/**
 * The internal id for a detected game, from its Nexus domain. Several known games can share
 * a domain (Neverwinter Nights and its Enhanced Edition, Skyrim SE and VR), and
 * `convertGameIdReverse` takes the first registered, which needn't be the one installed.
 * Taking the one discovery found instead puts the response's card on the game the user has,
 * so the detected section doesn't list that game again from discovery.
 */
export function detectedInternalId(
  knownGames: IGameStored[],
  discovered: { [gameId: string]: IDiscoveryResult },
  domain: string,
): string {
  const lowered = domain.toLowerCase();
  const installed = knownGames.filter(
    (game) =>
      (game.id === lowered || game.details?.nexusPageId === domain) &&
      discovered[game.id]?.path !== undefined,
  );

  return (
    installed.find((game) => game.id === lowered)?.id ??
    installed[0]?.id ??
    convertGameIdReverse(knownGames, domain)
  );
}
