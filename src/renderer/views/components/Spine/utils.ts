import * as path from "path";
import * as url from "url";

import type { IDiscoveryResult } from "../../../../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../../../../extensions/gamemode_management/types/IGameStored";

export const getGameImageUrl = (
  game: IGameStored,
  discovery: IDiscoveryResult | undefined,
): string | undefined => {
  // Check discovery for custom logo first
  const logo = discovery?.logo ?? game.logo;
  const extensionPath = discovery?.extensionPath ?? game.extensionPath;

  if (extensionPath !== undefined && logo !== undefined) {
    const logoPath = path.join(extensionPath, logo);
    return url.pathToFileURL(logoPath).href;
  }

  // Fall back to imageURL (remote URL)
  if (game.imageURL !== undefined) {
    return game.imageURL;
  }

  return undefined;
};
