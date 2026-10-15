import type { components } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { emitDetectedGamesEvent } from "@/extensions/analytics/utils/detectedGamesEvent";
import { toAvailableExtension, finite } from "@/extensions/extension_manager/availableExtensions";
import { createVortexNexusV3Client } from "@/extensions/nexus_integration/nexusV3Client";
import { isLoggedIn } from "@/extensions/nexus_integration/selectors";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import { getApplication } from "@/util/application";
import type { EpicGamesStoreEntry } from "@/util/EpicGamesLauncher";

import { setDetectedGames, setDetectedGamesStatus, setFavouriteGames } from "../../actions/session";
import type { DetectedGamesStatus, IDetectedGame } from "../../types/IDetectedGame";
import { getGameStoresSafe } from "../getGame";

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

/** Request currently running, so concurrent triggers (post-scan hook + login hook)
    share one call instead of racing past the payload hash concurrently. */
let inFlight: Promise<void> | undefined;

/** Forget the last accepted payload so the next request is sent even if unchanged. */
export function resetDetectedGamesHash(): void {
  lastSuccessfulPayload = undefined;
}

export interface IRequestDetectedGamesOptions {
  /** Send even if the payload is unchanged, as a scan the user asked for does. */
  force?: boolean;
}

/**
 * Collect the store listings found installed and resolve them against the
 * detected-games endpoint, writing the result and its status into session.gameMode.
 * Skipped when logged out, or when the payload is unchanged since the last successful
 * send unless forced. A request already running is shared. Never rejects: a failure is
 * logged and recorded in the status, for the Games page to show.
 */
export function requestDetectedGames(
  api: IExtensionApi,
  options: IRequestDetectedGamesOptions = {},
): Promise<void> {
  return share(api, options.force ?? false);
}

function share(api: IExtensionApi, force: boolean): Promise<void> {
  inFlight ??= requestDetectedGamesBody(api, force)
    .catch((err) => {
      log("warn", "detected-games: request failed", { error: getErrorMessageOrDefault(err) });
      recordFailure(api);
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/** Records a failed request, unless the user logged out while it ran: that says nothing about now. */
function recordFailure(api: IExtensionApi): void {
  let failed = true;
  try {
    failed = isLoggedIn(api.getState());
  } catch {
    // with the state unreadable, report the failure rather than hide it
  }
  api.store.dispatch(setDetectedGamesStatus(failed ? "failed" : undefined));
}

/** Clears a recorded failure, once something shows it no longer applies, for what does. */
function clearFailure(api: IExtensionApi, status: DetectedGamesStatus | undefined): void {
  if (api.getState().session?.gameMode?.detectedGamesStatus === "failed") {
    api.store.dispatch(setDetectedGamesStatus(status));
  }
}

async function requestDetectedGamesBody(api: IExtensionApi, force: boolean): Promise<void> {
  const state = api.getState();

  if (!isLoggedIn(state)) {
    // A failure from before logging out says nothing about now.
    clearFailure(api, undefined);
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

  if (!force && payload === lastSuccessfulPayload) {
    // The stored results are for this very payload, so they're current.
    clearFailure(api, "success");
    return;
  }

  void emitDetectedGamesEvent(api, listings).catch((err) =>
    log("warn", "failed to send detected games event", err),
  );

  api.store.dispatch(setDetectedGamesStatus("running"));

  const detected: IDetectedGame[] = [];
  const favouriteGames: number[] = [];
  try {
    const games = await createVortexNexusV3Client(api).resolveDetectedGames(body);

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
  } catch (err) {
    log("warn", "detected-games: request failed", { error: getErrorMessageOrDefault(err) });
    recordFailure(api);
    return;
  }

  api.store.dispatch(setDetectedGamesStatus("success"));
  lastSuccessfulPayload = payload;

  log("info", "detected-games: resolved installed games", {
    detected: detected.length,
    favourites: favouriteGames.length,
  });
}
