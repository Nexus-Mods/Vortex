import type { StoreGameVersionPayload } from "@vortex/nexus-api-v3";

import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import type { IDiscoveryResult } from "../../types/IDiscoveryResult";
import { getGame, getGameStoresSafe } from "../getGame";
import { scanGogInstall } from "./gogInstall";
import { scanSteamInstall } from "./steamInstall";

export type SteamInstallBlock = Extract<StoreGameVersionPayload, { store: "steam" }>["steam"];
export type GogInstallBlock = Extract<StoreGameVersionPayload, { store: "gog" }>["gog"];
export type InstallBlock = SteamInstallBlock | GogInstallBlock;
export type StoreId = "steam" | "gog";

/** Everything a game's store install contributes except the two game versions,
    the only expensive fields: failures carry their reason and `install` is null. */
export interface InstallRecord {
  storeId: StoreId;
  install: InstallBlock | null;
  failureReason: string | null;
}

/** Windows and POSIX disagree about separators and case; matches either way. */
const normPath = (value: string): string =>
  value
    .replace(/[/\\]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();

const inFolder = (entry: IGameStoreEntry, folder: string): boolean =>
  entry.gamePath !== undefined && normPath(entry.gamePath) === normPath(folder);

/** Collect the store install identity for one game, from the store's own files (the
    Steam appmanifest, the GOG .info), read again only when they changed. */
export async function scanInstall(
  internalGameId: string,
  discovery: IDiscoveryResult,
): Promise<InstallRecord> {
  const storeId = discovery.store as StoreId;
  const entries =
    getGameStoresSafe()
      .find((store) => store.id === storeId)
      ?.snapshot().entries ?? [];
  const atPath = entries.filter((iter) => inFolder(iter, discovery.path));
  if (storeId === "gog") {
    return scanGogInstall(discovery.path, atPath);
  }
  return scanSteamInstall(getGame(internalGameId), atPath, entries);
}
