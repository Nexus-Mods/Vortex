import path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import type { IDiscoveryResult } from "@/extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "@/extensions/gamemode_management/types/IGameStored";
import getVortexPath from "@/util/getVortexPath";
import { TString } from "@/util/i18n";

import getKnownFolders from "../sources/knownfolders";
import { getSteamMedia } from "../sources/steam";
import type { GameMediaSource, ResolvedGameMediaSource } from "../util/mediaTypes";

export default async function sourcesByDiscovery(
  game: IGameStored,
  discovery: IDiscoveryResult,
  flags: { showVideos?: boolean },
): Promise<Record<string, ResolvedGameMediaSource>> {
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
        name: new TString("sources::xbox::captures", {}, "media_page"),
        description: new TString("sources::xbox::captures_desc", {}, "media_page"),
        path: capturesFolder,
        filterFn: (f: string) =>
          f.toLowerCase().includes(name.toLowerCase().replace(":", "_")) ||
          f.toLowerCase().startsWith("screenshot"),
      };
      break;
    }
  }

  const resolved = await Promise.all(
    Object.entries(res).map(async ([id, source]) => {
      try {
        const resolvedPath = typeof source.path === "function" ? await source.path() : source.path;
        return resolvedPath ? ([id, { ...source, path: resolvedPath }] as const) : undefined;
      } catch (e: unknown) {
        window.api.log(
          "warn",
          "media source path resolution failed",
          JSON.stringify({ id, error: getErrorMessageOrDefault(e) }),
        );
        return undefined;
      }
    }),
  );

  return Object.fromEntries(resolved.filter((entry) => entry !== undefined));
}
