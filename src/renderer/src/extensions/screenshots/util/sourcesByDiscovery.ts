import fs from "fs/promises";
import path from "path";

import type { IDiscoveryResult, IGameStored } from "@/types/api";
import getVortexPath from "@/util/getVortexPath";

import Steam from "../../../util/Steam";
import getKnownFolders from "../sources/knownfolders";
import { clipsFolderBySteamID, screenshotsFolderBySteamID } from "../sources/steam";
import type { GameMediaSource } from "../util/mediaTypes";

export default async function sourcesByDiscovery(
  game: IGameStored,
  discovery: IDiscoveryResult,
): Promise<Record<string, GameMediaSource>> {
  const { name, id: gameId, details } = game;
  const { store, path: gamePath } = discovery;
  const res: Record<string, GameMediaSource> = {};

  if (details.mediaFolders && typeof details.mediaFolders === "object") {
    Object.assign(res, details.mediaFolders);
  }

  const known = getKnownFolders(gameId, discovery);
  // console.log("Known folders", { known, gameId });
  if (known !== undefined) Object.assign(res, known);

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
        description: `Screenshots captured by the Xbox Game Bar.`,
        path: capturesFolder,
        filterFn: (f: string) =>
          f.toLowerCase().includes(name.toLowerCase().replace(":", "_")) ||
          f.toLowerCase().startsWith("screenshot"),
        active: true,
      };
      break;
    }
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
    const screenshotFolder = await screenshotsFolderBySteamID(userDataFolder, user, steamId);
    Object.assign(res, screenshotFolder);
    const videosFolder = await clipsFolderBySteamID(userDataFolder, user, steamId);
    Object.assign(res, videosFolder);
  }
  return res;
}
