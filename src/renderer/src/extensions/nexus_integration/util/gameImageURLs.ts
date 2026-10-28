import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameId } from "@vortex/shared";

import type { IGameStored } from "../../gamemode_management/types/IGameStored";
import { nexusGames } from "../util";
import { nexusGameId } from "./convertGameId";

// Index the games list into a domain->id map for O(1) lookups (the Games page
// resolves this once per tile per render). Rebuilt only when the list is replaced.
let cachedList: IGameListEntry[] | undefined;
let domainToId = new Map<string, number>();

function nexusIdForDomain(domain: string): number | undefined {
  const list = nexusGames();
  if (list !== cachedList) {
    cachedList = list;
    domainToId = new Map(list.map((g) => [g.domain_name, g.id]));
  }
  return domainToId.get(domain);
}

/** The game's numeric Nexus id, if it has one (none for non-Nexus/community games). */
export function nexusGameIdForGame(game: IGameStored): GameId | undefined {
  const domain = nexusGameId(game);
  if (!domain) {
    return undefined;
  }

  const numericId = nexusIdForDomain(domain);
  return numericId ? GameId(numericId) : undefined;
}

/** The game's art named `name` on the Nexus image CDN, by its Nexus id. */
function imageURLForGameId(gameId: GameId, name: "hero" | "tile"): string {
  return `https://images.nexusmods.com/images/games/v2/${gameId}/${name}.jpg`;
}

/**
 * Resolve the Nexus "tile" art URL (2:3 portrait) for a game, matching the
 * artwork used on the Nexus Mods website. Returns undefined if no numeric
 * Nexus game id can be resolved (e.g. for non-Nexus/community games).
 */
export function gameTileImageURL(game: IGameStored): string | undefined {
  const gameId = nexusGameIdForGame(game);
  return gameId && imageURLForGameId(gameId, "tile");
}

/** The Nexus "hero" art URL (1920x620 banner), the cover the website heads a game's page with. */
export function heroImageURLForGameId(gameId: GameId): string {
  return imageURLForGameId(gameId, "hero");
}
