import path from "path";

import type { IDiscoveryResult, IGameStored } from "@/types/api";
import getVortexPath from "@/util/getVortexPath";

import getKnownFolders from "../sources/knownfolders";
import { getSteamMedia } from "../sources/steam";
import type { GameMediaSource } from "../util/mediaTypes";

export default async function sourcesByDiscovery(
  game: IGameStored,
  discovery: IDiscoveryResult,
  flags: { showVideos?: boolean },
): Promise<Record<string, GameMediaSource>> {
  const { name, id: gameId, details } = game;
  const { store, path: gamePath } = discovery;
  const res: Record<string, GameMediaSource> = {};

  if (details.mediaFolders && typeof details.mediaFolders === "object") {
    Object.assign(res, details.mediaFolders);
  }

  const known = getKnownFolders(gameId, discovery);
  if (known !== undefined) Object.assign(res, known);

  switch (store) {
    case "steam": {
      const steamAppId = game.details?.steamAppId ? String(game.details?.steamAppId) : undefined;
      const steamMedia = await getSteamMedia(gamePath, flags, steamAppId);
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
      };
      break;
    }
  }

  return res;
}
