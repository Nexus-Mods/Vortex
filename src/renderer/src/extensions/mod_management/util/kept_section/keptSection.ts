import type { NexusGameDomain } from "@vortex/shared";

import {
  convertId,
  findGame,
  type IGameData,
  storedGameQuery,
} from "@/extensions/gamemode_management/queries";

import type { IModWithState } from "../../types/IModProps";

/** What a mod's game section is kept as, alone or first in a list; none if not kept. */
export const keptDownloadGame = (mod: IModWithState): string | undefined => {
  const kept: unknown = mod.attributes?.downloadGame;
  const first: unknown = Array.isArray(kept) ? kept[0] : kept;
  return typeof first === "string" && first !== "" ? first : undefined;
};

/**
 * The Nexus Mods game a mod's section is, from how the legacy field keeps it: the Vortex game's id,
 * or, for a game Vortex has no extension for, its domain, as the games data says it is. Also the
 * Vortex game it names, if it's one, to name a section the site doesn't have yet. No section where
 * it's neither, or where the game has none on the site.
 */
export const keptSection = (
  games: IGameData,
  kept: string,
): { section?: NexusGameDomain; vortexGameName?: string } => {
  const query = storedGameQuery(games, kept);
  if (query === undefined) {
    return {};
  }
  if ("gameDomain" in query) {
    return { section: query.gameDomain };
  }

  return {
    section: convertId(games, query, "gameDomain"),
    vortexGameName: findGame(games, query)?.name,
  };
};
