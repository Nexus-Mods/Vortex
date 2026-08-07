import fs from "fs/promises";
import path from "path";

import { parse } from "simple-vdf";

import type { IDiscoveryResult, IGameStored } from "@/types/api";
import getVortexPath from "@/util/getVortexPath";

import Steam from "../../../util/Steam";
import type { MediaSource, SteamScreenshotsVDF } from "../util/mediaTypes";

export default async function sourcesByDiscovery(
  game: IGameStored,
  discovery: IDiscoveryResult,
): Promise<Record<string, MediaSource>> {
  const { name, id: gameId } = game;
  const { store, path: gamePath } = discovery;
  const res: Record<string, MediaSource> = {};
  switch (store) {
    case "steam": {
      const steamMedia = await getSteamMedia(gamePath, String(game.details?.steamAppId));
      Object.assign(res, steamMedia);
      break;
    }
    case "xbox": {
      const capturesFolder = path.join(getVortexPath("home"), "Videos", "Captures");
      res["xbox-default-captures"] = {
        name: "Xbox Captures",
        description: `Screenshots and videos captured by the Xbox Game Bar.`,
        path: capturesFolder,
        filterFn: (f: string) =>
          f.toLowerCase().includes(name.toLowerCase().replace(":", "_")) ||
          f.toLowerCase().startsWith("screenshot"),
        active: true,
      };
      break;
    }
  }

  if (gameId === "starfield") {
    res["starfield-mygames"] = {
      name: "My Games Folder",
      path: path.join(getVortexPath("documents"), "My Games", "Starfield", "Photos"),
      active: true,
      filterFn: (f) => !f.toLowerCase().includes("thumbnail"),
    };
  }

  return res;
}

async function getSteamMedia(
  gamePath: string,
  knownId?: string | number,
): Promise<Record<string, MediaSource>> {
  const res: Record<string, MediaSource> = {};
  const steamPath = await Steam.getGameStorePath();
  const steamGame = (await Steam.allGames()).find((g) => g.gamePath === gamePath);
  if (!steamGame) return res;
  const steamId = knownId ? String(knownId) : steamGame.appid;
  const userDataFolder = path.resolve(steamPath, "..", "userdata");
  const steamUsers = await fs.readdir(userDataFolder);
  for (const user of steamUsers) {
    // Images live at userdata\{USER ID}\760\remote\{STEAM APP ID}\screenshots
    // Images have a manifest at userdata\{USER ID}\760\remote\screenshots.vdf
    const screenshotsVDF = path.join(userDataFolder, user, "760", "screenshots.vdf");
    try {
      await fs.access(screenshotsVDF);
      const raw = await fs.readFile(screenshotsVDF, { encoding: "utf-8" });
      const parsed = parse(raw) as SteamScreenshotsVDF;
      if (Object.keys(parsed?.screenshots?.[steamId]).length) {
        res[`steam-screenshots-${user}`] = {
          name: "Steam Screenshots",
          description: `Screenshots for Steam ID ${user}`,
          path: path.join(userDataFolder, user, "760", "remote", steamId, "screenshots"),
          active: true,
        };
      }
    } catch (err) {
      if (!(err as Error).message.includes("ENOENT"))
        console.log("Failed to acccess VDF", { screenshotsVDF, err });
    }

    // Videos live at userdata\{USER ID}\gamerecordings\clips\
    // with a subfolder for each clip, containing a Thumbnail.jpg
    // folder names are clip_{STEAM ID}_{YYYMMDD}_{HHMMSS(UTC Time)}
    const videosFolder = path.join(userDataFolder, user, "gamerecordings", "clips");
    try {
      await fs.access(videosFolder);
      const dirList = await fs.readdir(videosFolder);
      const gameClips = dirList.filter((d) => d.toLowerCase().startsWith(`clip_${steamId}`));
      if (gameClips.length > 0) {
        res[`steam-videos-${user}`] = {
          name: "Steam Clips",
          path: videosFolder,
          description: `Clips for Steam ID ${user}`,
          filterFn: (s) => s.toLowerCase().startsWith(`clip_${steamId}`),
          active: true,
        };
      }
    } catch (err) {
      if (!(err as Error).message.includes("ENOENT"))
        console.log("Failed to acccess Steam videos folder", { videosFolder, err });
    }
  }
  return res;
}
