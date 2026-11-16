import { VortexGameId, type NexusGameId } from "@vortex/shared";

/**
 * The ID Vortex gives a Tier 0 game it manages: `tier-0-{gameId}`.
 * Deliberately not the game's nexus domain, so it can't be mistaken for one or collide with
 * the id of an extension game. The domain of such a game is its `details.nexusPageId`.
 */
export function tierZeroGameId(gameId: NexusGameId): VortexGameId {
  return VortexGameId(`tier-0-${gameId}`);
}
