import { QualifiedPath } from "@vortex/shared/filesystem";

import type { IGame } from "@/types/IGame";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import type { ISteamEntry } from "@/util/Steam";
import { installDataFromManifest } from "@/util/steamManifest";
import { normalizeStoreQuery } from "@/util/storeQuery";

import { cachedFileParser } from "./cachedFileParser";
import type { InstallRecord } from "./storeInstall";

/** The Steam app ids the game's extension declares, empty when it declares none. */
function gameSteamAppIds(game: IGame | undefined): Set<string> {
  const ids = new Set<string>();
  if (game?.details?.steamAppId !== undefined) {
    ids.add(String(game.details.steamAppId));
  }
  for (const query of normalizeStoreQuery(game?.queryArgs?.steam)) {
    if (query.id !== undefined) {
      ids.add(query.id);
    }
  }
  return ids;
}

/** Install data per appmanifest, read again only when the manifest changed: Steam may
    update a game while Vortex runs. */
const readInstallData = cachedFileParser(installDataFromManifest);

/** The Steam install of the game, from the manifests at its folder (`atPath`) or,
    failing those, any of Steam's manifests (`entries`) for one of its own app ids. */
export async function scanSteamInstall(
  game: IGame | undefined,
  atPath: IGameStoreEntry[],
  entries: IGameStoreEntry[],
): Promise<InstallRecord> {
  const ownIds = gameSteamAppIds(game);
  // tools like the Creation Kit install into the game's own folder, so the path alone
  // can match several manifests: the game's own app id decides between them
  const entry =
    atPath.find((iter) => ownIds.has(iter.appid)) ??
    atPath[0] ??
    // the game variant Steam runs may deploy from a path different from its manifest's
    entries.find((iter) => ownIds.has(iter.appid));

  if (entry === undefined) {
    return {
      storeId: "steam",
      install: null,
      failureReason: "store-entry-not-found",
    };
  }

  const manifest = await readInstallData(
    QualifiedPath.fromNative((entry as ISteamEntry).manifestPath),
  );
  if (manifest.status !== "parsed") {
    return {
      storeId: "steam",
      install: null,
      // a manifest gone since the scan means the game was uninstalled or moved
      failureReason: manifest.status === "missing" ? "store-entry-not-found" : "acf-unreadable",
    };
  }
  const data = manifest.value;
  if (data === undefined) {
    return {
      storeId: "steam",
      install: null,
      failureReason: "acf-parse-failed",
    };
  }
  return {
    storeId: "steam",
    install: {
      app_id: data.appId,
      build_id: data.buildId,
      branch: data.branch,
      language: data.language,
      mounted_language: data.mountedLanguage,
      state_flags: data.stateFlags,
      target_build_id: data.targetBuildId,
      depots: data.depots.map((depot) => ({
        depot_id: depot.depotId,
        manifest_id: depot.manifestId,
        dlc_app_id: depot.dlcAppId,
      })),
      shared_depots: data.sharedDepots.map((depot) => ({
        depot_id: depot.depotId,
        owner_app_id: depot.ownerAppId,
      })),
    },
    failureReason: null,
  };
}
