import type { IGameStored } from "../../gamemode_management/types/IGameStored";
import { nexusGames } from "../util";
import { nexusGameId } from "./convertGameId";

/**
 * Resolve the Nexus "tile" art URL (2:3 portrait) for a game, matching the
 * artwork used on the Nexus Mods website. Returns undefined if no numeric
 * Nexus game id can be resolved (e.g. for non-Nexus/community games).
 */
export function gameTileImageURL(game: IGameStored): string | undefined {
  const domain = nexusGameId(game);
  const numericId =
    domain != null ? nexusGames().find((g) => g.domain_name === domain)?.id : undefined;
  return numericId !== undefined
    ? `https://images.nexusmods.com/images/games/v2/${numericId}/tile.jpg`
    : undefined;
}
