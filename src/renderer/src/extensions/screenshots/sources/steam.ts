import fs from "fs/promises";
import path from "path";

import { parse } from "simple-vdf";

import type { GameMediaItem, GameMediaSource, SteamScreenshotsVDF } from "../util/mediaTypes";

export async function screenshotsFolderBySteamID(
  userDataFolder: string,
  user: string,
  steamGameId: string,
): Promise<Record<string, GameMediaSource>> {
  // Images live at userdata\{USER ID}\760\remote\{STEAM APP ID}\screenshots
  // Images have a manifest at userdata\{USER ID}\760\remote\screenshots.vdf
  const res: Record<string, GameMediaSource> = {};
  const screenshotsVDF = path.join(userDataFolder, user, "760", "screenshots.vdf");
  try {
    await fs.access(screenshotsVDF);
    const raw = await fs.readFile(screenshotsVDF, { encoding: "utf-8" });
    const parsed = parse(raw) as SteamScreenshotsVDF;
    if (
      parsed?.screenshots?.[steamGameId] &&
      Object.keys(parsed?.screenshots?.[steamGameId]).length
    ) {
      res[`steam-screenshots-${user}`] = {
        name: "Steam Screenshots",
        description: `Screenshots for Steam User ID ${user}`,
        path: path.join(userDataFolder, user, "760", "remote", steamGameId, "screenshots"),
      };
    }
  } catch (err) {
    if (!(err as Error).message.includes("ENOENT"))
      console.log("Failed to acccess VDF", { screenshotsVDF, err });
  }
  return res;
}

export async function clipsFolderBySteamID(
  userDataFolder: string,
  user: string,
  steamGameId: string,
): Promise<Record<string, GameMediaSource>> {
  const res: Record<string, GameMediaSource> = {};
  // Videos live at userdata\{USER ID}\gamerecordings\clips\
  // with a subfolder for each clip, containing a Thumbnail.jpg
  // folder names are clip_{STEAM ID}_{YYYMMDD}_{HHMMSS(UTC Time)}
  // Videos aren't stored in a format we can easily play, so we should probably open steam://nav/games/details/{Steam GAME ID} for the user
  const videosFolder = path.join(userDataFolder, user, "gamerecordings", "clips");
  try {
    await fs.access(videosFolder);
    const dirList = await fs.readdir(videosFolder);
    const gameClips = dirList.filter((d) => d.toLowerCase().startsWith(`clip_${steamGameId}`));
    if (gameClips.length > 0) {
      res[`steam-videos-${user}`] = {
        name: "Steam Clips",
        path: videosFolder,
        description: `Clips for Steam ID User ${user}`,
        discoverFn: (mediaPath: string) => discoverSteamClips(mediaPath, steamGameId, user),
      };
    }
  } catch (err) {
    if (!(err as Error).message.includes("ENOENT"))
      console.log("Failed to acccess Steam videos folder", { videosFolder, err });
  }

  return res;
}

async function discoverSteamClips(
  mediaPath: string,
  steamGameId: string,
  userId: string,
): Promise<GameMediaItem[]> {
  const clips = await fs.readdir(mediaPath);
  const thisGameClips = clips.filter((s) => s.toLowerCase().startsWith(`clip_${steamGameId}`));
  return Promise.all(
    thisGameClips.map(async (c) => {
      const clipPath = path.join(mediaPath, c);
      const stats = await fs.stat(clipPath);
      const videoPaths = await fs.readdir(path.join(clipPath, "video"));
      const sessionMPD = videoPaths[0]
        ? path.join(clipPath, "video", videoPaths[0], "session.mpd")
        : undefined;
      return {
        id: `steam-videos-${userId}-${c}`,
        path: sessionMPD ?? clipPath,
        name: c,
        sourceId: `steam-videos-${userId}`,
        type: "video",
        thumbnailPath: path.join(mediaPath, c, "thumbnail.jpg"),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    }),
  );
  // return thisGameClips.map((c) => ({
  //   id: `steam-videos-${userId}-${c}`,
  //   path: path.join(mediaPath, c),
  //   name: c,
  //   sourceId: `steam-videos-${userId}`,
  //   type: "video",
  //   thumbnailPath: path.join(mediaPath, c, "thumbnail.jpg"),
  //   createdAt: stats.birthtime,
  //   modifiedAt: stats.mtime,
  // }));
}
