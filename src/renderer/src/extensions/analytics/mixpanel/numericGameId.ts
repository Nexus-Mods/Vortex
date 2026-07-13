import { getGame } from "../../gamemode_management/util/getGame";
import { nexusGames } from "../../nexus_integration/util";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";

/**
 * Numeric Nexus game id for an internal game id, so every analytics event carries game_id in the
 * same form. null when the game isn't a Nexus game or the games cache hasn't loaded.
 */
export function numericNexusGameId(internalGameId: string): number | null {
  const domain = nexusGameId(getGame(internalGameId), internalGameId);
  return nexusGames().find((game) => game.domain_name === domain)?.id ?? null;
}
