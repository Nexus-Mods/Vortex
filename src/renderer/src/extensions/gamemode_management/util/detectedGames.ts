import type { components } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { toAvailableExtension, finite } from "@/extensions/extension_manager/availableExtensions";
import { createVortexNexusV3Client } from "@/extensions/nexus_integration/nexusV3Client";
import { isLoggedIn } from "@/extensions/nexus_integration/selectors";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import { getApplication } from "@/util/application";
import type { EpicGamesStoreEntry } from "@/util/EpicGamesLauncher";

import { setDetectedGames, setFavouriteGames } from "../actions/session";
import type { IDetectedGame } from "../types/IDetectedGame";
import { getGameStoresSafe } from "./getGame";

type DetectedGame = components["schemas"]["DetectedGame"];

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

export function collectListings(getStores: () => IGameStore[]) {
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

/** JSON of the last payload the endpoint accepted; used to skip identical re-sends. */
let lastSuccessfulPayload: string | undefined;

/** Forget the last accepted payload so the next request is sent even if unchanged. */
export function resetDetectedGamesHash(): void {
  lastSuccessfulPayload = undefined;
}

function toDetectedGame(game: DetectedGame, gameId: number): IDetectedGame {
  return {
    gameUid: game.game_uid,
    gameId,
    imageUrl: game.image_url ?? undefined,
    storeIDs: {
      steam: Array.from(game.store_ids.steam),
      gog: Array.from(game.store_ids.gog),
      epic: Array.from(game.store_ids.epic),
    },
    extension:
      game.extension === null
        ? undefined
        : (toAvailableExtension(game.extension, { type: "game", gameId }) ?? undefined),
  };
}

/**
 * Collect the store listings found installed and resolve them against the
 * detected-games endpoint, writing the result into session.gameMode. Skipped
 * when logged out or when the payload is unchanged since the last successful
 * send. Fire and forget: failures are logged, never surfaced to the user.
 */
export async function requestDetectedGames(api: IExtensionApi): Promise<void> {
  const state = api.getState();

  if (!isLoggedIn(state)) {
    return;
  }

  const instanceId = state.app.instanceId;
  if (instanceId === undefined || instanceId.length === 0) {
    log("debug", "detected-games: no instance id, skipping request");
    return;
  }

  const listings = collectListings(getGameStoresSafe);
  const body = {
    instance_id: instanceId,
    vortex_version: getApplication().version,
    ...listings,
  };

  const payload = JSON.stringify(body);

  if (payload === lastSuccessfulPayload) {
    return;
  }

  let games: DetectedGame[];
  try {
    games = await createVortexNexusV3Client(api).resolveDetectedGames(body);
  } catch (err) {
    log("warn", "detected-games: request failed", { error: getErrorMessageOrDefault(err) });
    return;
  }

  const detected: IDetectedGame[] = [];
  const favouriteGames: number[] = [];
  for (const game of games) {
    const gameId = finite(game.game_id);
    if (gameId === undefined) {
      log("debug", "detected-games: dropped entry with unusable game id", {
        game_uid: game.game_uid,
      });

      continue;
    }

    detected.push(toDetectedGame(game, gameId));
    if (game.is_favourite) favouriteGames.push(gameId);
  }

  api.store.dispatch(setDetectedGames(detected));
  api.store.dispatch(setFavouriteGames(favouriteGames));

  lastSuccessfulPayload = payload;

  log("info", "detected-games: resolved installed games", {
    detected: detected.length,
    favourites: favouriteGames.length,
  });
}
