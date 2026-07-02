import type { IGameListEntry } from "@nexusmods/nexus-api";

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

/**
 * Resolve the Nexus "tile" art URL (2:3 portrait) for a game, matching the
 * artwork used on the Nexus Mods website. Returns undefined if no numeric
 * Nexus game id can be resolved (e.g. for non-Nexus/community games).
 */
export function gameTileImageURL(game: IGameStored): string | undefined {
  const domain = nexusGameId(game);
  const numericId = domain != null ? nexusIdForDomain(domain) : undefined;
  return numericId !== undefined
    ? `https://images.nexusmods.com/images/games/v2/${numericId}/tile.jpg`
    : undefined;
}
