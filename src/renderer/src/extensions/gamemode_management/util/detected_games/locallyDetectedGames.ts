import type { IGameStored } from "@/types/IState";

import type { IDiscoveryResult } from "../../types/IDiscoveryResult";

export interface ILocallyDetectedOptions {
  /** Games with a profile, which the Added section lists instead. */
  addedGameIds: ReadonlySet<string>;
  /** Games the detected-games response already put on the page. */
  listedIds?: ReadonlySet<string>;
  /** Keep games the user hid, as "Show hidden" and a search do. */
  includeHidden?: boolean;
}

/**
 * The known games discovery found installed that the user hasn't added, for the Games
 * page's detected section to list next to the detected-games response. The response only
 * resolves Steam, GOG and Epic games that Nexus Mods lists, and is empty while logged out,
 * so a game from another store, or with an extension that isn't on the site yet, only
 * reaches the section through here.
 */
export function locallyDetectedGames(
  knownGames: IGameStored[],
  discovered: { [gameId: string]: IDiscoveryResult },
  options: ILocallyDetectedOptions,
): IGameStored[] {
  const { addedGameIds, includeHidden = false, listedIds = new Set<string>() } = options;

  return knownGames.filter((game) => {
    const discovery = discovered[game.id];

    return (
      discovery?.path !== undefined &&
      !addedGameIds.has(game.id) &&
      !listedIds.has(game.id) &&
      (includeHidden || !(discovery.hidden ?? false))
    );
  });
}
