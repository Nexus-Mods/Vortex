import path from "path";

import type { IDiscoveryResult } from "@/types/api";
import getVortexPath from "@/util/getVortexPath";

import type { GameMediaSource } from "../util/mediaTypes";

const knownFolders: Record<
  string,
  (discovery?: IDiscoveryResult) => Record<string, GameMediaSource>
> = {
  starfield: () => ({
    "starfield-mygames": {
      name: "Photo Mode",
      description: "Screenshots captured using the in-game Photo Mode.",
      path: path.join(getVortexPath("documents"), "My Games", "Starfield", "Photos"),
      filterFn: (f) => !f.toLowerCase().includes("thumbnail"),
    },
  }),
  skyrimse: (discovery) => ({
    "game-screenshots": {
      name: "Game Screenshots",
      description: "Screenshots captured using Print Screen.",
      path: discovery.path,
      filterFn: (f) => f.startsWith("ScreenShot") && path.extname(f) === ".png",
    },
  }),
  stardewvalley: () => ({
    "game-screenshots": {
      name: "Game Screenshots",
      description: "Screenshots taken in-game.",
      path: path.join(getVortexPath("appData"), "StardewValley", "screenshots"),
    },
  }),
  cyberpunk2077: () => ({
    "game-screenshots": {
      name: "Game Screenshots",
      description: "Screenshots taken in-game",
      path: path.join(getVortexPath("home"), "Pictures", "Cyberpunk 2077"),
    },
  }),
  witcher3: () => ({
    "game-screenshots": {
      name: "Game Screenshots",
      description: "Screenshots taken in-game",
      path: path.join(getVortexPath("home"), "Pictures", "The Witcher 3"),
    },
    "game-videos": {
      name: "Game Videos",
      description: "Videos taken in-game",
      path: path.join(getVortexPath("home"), "Videos", "The Witcher 3"),
    },
  }),
  baldursgate3: () => ({
    "game-screenshots": {
      name: "Game Screenshots",
      description: "Screenshots taken in-game",
      path: path.join(
        getVortexPath("documents"),
        "Larian Studios",
        "Baldur's Gate 3",
        "Screenshots",
      ),
    },
  }),
};

const getKnownFolders = (
  gameId: string,
  discovery: IDiscoveryResult,
): Record<string, GameMediaSource> | undefined => {
  if (!(gameId in knownFolders)) return undefined;
  return knownFolders[gameId](discovery);
};

export default getKnownFolders;
