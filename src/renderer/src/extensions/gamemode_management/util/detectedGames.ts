import { log } from "@/logging";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import type { EpicGamesStoreEntry } from "@/util/EpicGamesLauncher";

export type StoreListings = {
  steam: string[];
  gog: string[];
  epic: string[];
};

function collectStore(
  store: IGameStore | undefined,
  toListing: (entry: IGameStoreEntry) => string | undefined,
): string[] {
  if (!store) return [];

  const entries = store.snapshot().entries;
  const unique = new Set<string>();

  for (const entry of entries) {
    const listing = toListing(entry);
    if (listing !== undefined) {
      unique.add(listing);
    }
  }

  const listings = Array.from(unique).sort();
  return listings;
}

export function collectListings(getStores: () => IGameStore[]): StoreListings {
  let stores: IGameStore[] = [];
  try {
    stores = getStores();
  } catch (err) {
    log("debug", "stores have yet to load", err);
  }

  const byId = new Map(stores.map((store) => [store.id, store]));
  return {
    steam: collectStore(byId.get("steam"), (entry) => entry.appid),
    gog: collectStore(byId.get("gog"), (entry) => entry.appid),
    epic: collectStore(byId.get("epic"), (entry) => {
      if (!isEpicEntry(entry)) return undefined;
      return `${entry.catalogNamespace}:${entry.catalogItemId}`;
    }),
  };
}

function isEpicEntry(entry: IGameStoreEntry): entry is EpicGamesStoreEntry {
  return (
    "catalogNamespace" in entry &&
    typeof entry.catalogNamespace === "string" &&
    "catalogItemId" in entry &&
    typeof entry.catalogItemId === "string"
  );
}
