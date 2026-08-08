import path from "path";

import type { IDiscoveryResult } from "@/types/api";
import getVortexPath from "@/util/getVortexPath";

import type { MediaSource } from "../util/mediaTypes";

const knownFolders: Record<string, (discovery?: IDiscoveryResult) => Record<string, MediaSource>> =
  {
    starfield: () => ({
      "starfield-mygames": {
        name: "Photo Mode",
        description: "Screenshots captured using the in-game Photo Mode.",
        path: path.join(getVortexPath("documents"), "My Games", "Starfield", "Photos"),
        active: true,
        filterFn: (f) => !f.toLowerCase().includes("thumbnail"),
      },
    }),
    skyrimse: (discovery) => ({
      "game-screenshots": {
        name: "Game Screenshots",
        description: "Screenshots captured using Print Screen.",
        path: discovery.path,
        active: true,
        filterFn: (f) => f.startsWith("ScreenShot") && path.extname(f) === ".png",
      },
    }),
    stardewvalley: () => ({
      "game-screenshots": {
        name: "Game Screenshots",
        description: "Screenshots taken in-game.",
        path: path.join(getVortexPath("appData"), "StardewValley", "screenshots"),
        active: true,
      },
    }),
  };

const getKnownFolders = (
  gameId: string,
  discovery: IDiscoveryResult,
): Record<string, MediaSource> | undefined => {
  if (!(gameId in knownFolders)) return undefined;
  return knownFolders[gameId](discovery);
};

export default getKnownFolders;
