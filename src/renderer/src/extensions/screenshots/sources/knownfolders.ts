import path from "path";

import type { IDiscoveryResult } from "@/extensions/gamemode_management/types/IDiscoveryResult";
import getVortexPath from "@/util/getVortexPath";
import { TString } from "@/util/i18n";

import type { GameMediaSource } from "../util/mediaTypes";

const knownFolders: Record<
  string,
  (discovery?: IDiscoveryResult) => Record<string, GameMediaSource>
> = {
  starfield: () => ({
    "starfield-mygames": {
      name: new TString("sources::photo_mode", {}, "media_page"),
      description: new TString("sources::photo_mode_description", {}, "media_page"),
      path: path.join(getVortexPath("documents"), "My Games", "Starfield", "Photos"),
      filterFn: (f) => !f.toLowerCase().includes("thumbnail"),
    },
  }),
  skyrimse: (discovery) => ({
    "game-screenshots": {
      name: new TString("sources::screenshots", {}, "media_page"),
      description: new TString("sources::screenshots_desc_prtscr", {}, "media_page"),
      path: discovery.path,
      filterFn: (f) => f.startsWith("ScreenShot") && path.extname(f) === ".png",
    },
  }),
  stardewvalley: () => ({
    "game-screenshots": {
      name: new TString("sources::screenshots", {}, "media_page"),
      description: new TString("sources::screenshots_desc", {}, "media_page"),
      path: path.join(getVortexPath("appData"), "StardewValley", "screenshots"),
    },
  }),
  cyberpunk2077: () => ({
    "game-screenshots": {
      name: new TString("sources::screenshots", {}, "media_page"),
      description: new TString("sources::screenshots_desc", {}, "media_page"),
      path: path.join(getVortexPath("home"), "Pictures", "Cyberpunk 2077"),
    },
  }),
  witcher3: () => ({
    "game-screenshots": {
      name: new TString("sources::screenshots", {}, "media_page"),
      description: new TString("sources::screenshots_desc", {}, "media_page"),
      path: path.join(getVortexPath("home"), "Pictures", "The Witcher 3"),
    },
    "game-videos": {
      name: new TString("sources::videos", {}, "media_page"),
      description: new TString("sources::videos_desc", {}, "media_page"),
      path: path.join(getVortexPath("home"), "Videos", "The Witcher 3"),
    },
  }),
  baldursgate3: () => ({
    "game-screenshots": {
      name: new TString("sources::screenshots", {}, "media_page"),
      description: new TString("sources::screenshots_desc", {}, "media_page"),
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
