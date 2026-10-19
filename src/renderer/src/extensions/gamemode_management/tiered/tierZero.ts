import * as path from "node:path";

import type { GameId } from "@vortex/shared";
import PromiseBB from "bluebird";

import type { IGame } from "@/types/IGame";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import type { ITierZeroGame } from "@/types/IState";
import type { IQueryArgEntry } from "@/util/storeQuery";

import { getGameStore } from "../util/getGame";

const TIER_ZERO_STORES: string[] = ["steam", "gog", "epic"];

/** game ids of games managed without a game extension. Provenance is kept here
 * and not on IGame so nothing about the synthesized object gives it away. */
const tierZeroGameIds = new Set<GameId>();

export function isTierZeroGame(gameId: GameId): boolean {
  return tierZeroGameIds.has(gameId);
}

/** the game object was dropped from the registry again (un-manage) */
export function unregisterTierZeroGame(gameId: GameId): void {
  tierZeroGameIds.delete(gameId);
}

function snapshotEntries(storeId: string): IGameStoreEntry[] {
  try {
    return getGameStore(storeId)?.snapshot()?.entries ?? [];
  } catch {
    // manager not attached yet; nothing can be resolved against snapshots then
    return [];
  }
}

/**
 * The AppName-style ids the epic launcher uses internally for the game's
 * catalog listings. The endpoint reports "catalogNamespace:catalogItemId"
 * strings which don't match anything in the snapshot by themselves; a listing
 * that matches no entry falls back to the game's exact display name.
 */
export function epicAppNames(entry: ITierZeroGame): string[] {
  const epicEntries = snapshotEntries("epic");
  return entry.storeIDs.epic.reduce<string[]>((prev, listing) => {
    const [namespace, itemId] = listing.split(":");
    const matched =
      epicEntries.find(
        (iter) =>
          "catalogNamespace" in iter &&
          iter.catalogNamespace === namespace &&
          "catalogItemId" in iter &&
          iter.catalogItemId === itemId,
      ) ?? epicEntries.find((iter) => iter.name === entry.name);
    return matched !== undefined ? [...prev, matched.appid] : prev;
  }, []);
}

function buildQueryArgs(entry: ITierZeroGame): { [storeId: string]: IQueryArgEntry } {
  const res: { [storeId: string]: IQueryArgEntry } = {};
  if (entry.storeIDs.steam.length > 0) {
    res.steam = entry.storeIDs.steam.map((id) => ({ id }));
  }

  if (entry.storeIDs.gog.length > 0) {
    res.gog = entry.storeIDs.gog.map((id) => ({ id }));
  }

  if (entry.storeIDs.epic.length > 0) {
    const appNames = epicAppNames(entry);
    res.epic = [
      ...appNames.map((id) => ({ id })),
      // exact-name query as fallback for listings the catalog ids didn't resolve
      { name: entry.name },
    ];
  }

  return res;
}

/**
 * the id of the store entry to launch, from the store the game was discovered
 * through. With several listings (e.g. editions) the discovered install decides,
 * falling back to the first recorded listing.
 */
function launchId(entry: ITierZeroGame, store: string, gamePath: string): string | undefined {
  if (!TIER_ZERO_STORES.includes(store)) return undefined;

  const ids = store === "epic" ? epicAppNames(entry) : entry.storeIDs[store as "steam" | "gog"];

  if (ids.length <= 1) {
    return ids[0];
  }

  const norm = (p: string) =>
    path
      .normalize(p ?? "")
      .replace(/[\\/]+$/, "")
      .toLowerCase();
  const matched = snapshotEntries(store).find(
    (iter) => iter.gamePath !== undefined && norm(iter.gamePath) === norm(gamePath),
  );

  return matched?.appid ?? ids[0];
}

/**
 * synthesize the game for a persisted Tier 0 entry; the entry's nexus domain
 * becomes the game's id. Returns undefined when a loaded extension game
 * already owns the domain, in which case the extension wins.
 */
export function makeTierZeroGame(entry: ITierZeroGame, knownGames: IGame[]): IGame | undefined {
  const { domain } = entry;
  if (knownGames.some((game) => game.id === domain || game.details?.nexusPageId === domain)) {
    return undefined;
  }

  tierZeroGameIds.add(entry.gameId);

  return {
    id: domain,
    name: entry.name,
    // mods install to the game root
    queryModPath: () => ".",
    requiredFiles: [],
    // no exe is known: launching goes through the store (requiresLauncher) and
    // the version stays "unknown" unless the user picks an executable
    executable: () => "",
    getGameVersion: () => Promise.resolve("unknown"),
    // mandatory: game mode activation calls getInstalledVersion and the stock
    // resolver rejects for the empty placeholder exe
    getInstalledVersion: () => PromiseBB.resolve("unknown"),
    // evaluated on access, not at synthesis: the store snapshots reload after
    // this object exists, so a static value would go stale (epic especially,
    // whose ids only exist after the snapshot has been parsed)
    get queryArgs() {
      return buildQueryArgs(entry);
    },
    requiresLauncher: (gamePath, store) => {
      if (store !== undefined && TIER_ZERO_STORES.includes(store)) {
        return PromiseBB.resolve({
          launcher: store,
          addInfo: launchId(entry, store, gamePath),
        });
      }

      return PromiseBB.resolve(undefined);
    },
  } satisfies IGame;
}
