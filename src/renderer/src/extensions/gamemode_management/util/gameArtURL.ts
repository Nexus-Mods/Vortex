import * as path from "path";
import * as url from "url";

import { gameTileImageURL } from "@/extensions/nexus_integration/util/gameTileImageURL";

import type { IGameStored } from "../types/IGameStored";

/**
 * The art a game tile shows: the Nexus tile image where there is one, so Vortex matches
 * the website, and the extension's own logo where there isn't.
 *
 * Returns something an `<img>` can load, so a local path comes back as a file URL.
 */
export const gameArtURL = (game: IGameStored): string | undefined => {
  const logoPath =
    gameTileImageURL(game) ??
    (game.extensionPath !== undefined && game.logo !== undefined
      ? path.join(game.extensionPath, game.logo)
      : game.imageURL);

  if (logoPath == null) {
    return undefined;
  }

  try {
    if (new URL(logoPath).protocol.startsWith("http")) {
      return logoPath;
    }
  } catch {
    // Not a URL, so it's the path it looks like.
  }

  return url.pathToFileURL(logoPath).href;
};
