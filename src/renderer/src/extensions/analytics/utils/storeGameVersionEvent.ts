import type { StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { v4 as uuid } from "uuid";

import { setStoreGameVersionCache } from "@/extensions/analytics/actions/telemetry.action";
import type { IStoreGameVersionCacheEntry } from "@/extensions/analytics/types/telemetry";
import { log } from "@/logging";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { discoveryByGame, discovered } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";
import { readGameVersions } from "../../gamemode_management/util/getGameVersion";
import {
  scanInstall,
  type GogInstallBlock,
  type InstallBlock,
  type InstallRecord,
  type SteamInstallBlock,
  type StoreId,
} from "../../gamemode_management/util/store_install/storeInstall";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/** The store's install block without the fields that change while the install stays the same. */
function stableInstallBlock(payload: StoreGameVersionPayload): unknown {
  switch (payload.store) {
    case "steam":
      // these flip on routine updates (per MOD-12)
      return { ...payload.steam, state_flags: undefined, target_build_id: undefined };
    case "gog":
      return payload.gog;
    case "epic":
    case "xbox":
      return undefined;
    default: {
      const exhausted: never = payload;
      return exhausted;
    }
  }
}

/** Change-check hash for one payload. */
export function storeGameVersionChangeKey(payload: StoreGameVersionPayload): string {
  return JSON.stringify([
    payload.game_id,
    payload.failure_reason,
    payload.exe_version,
    payload.extension_version,
    payload.store,
    stableInstallBlock(payload),
  ]);
}

/** Cache writes dispatch through the analytics reducer under
    persistent.analyticsTelemetry, which persists across Vortex sessions. */
function refreshCache(
  api: IExtensionApi,
  gameId: string,
  entry: IStoreGameVersionCacheEntry,
): void {
  api.store.dispatch(setStoreGameVersionCache({ gameId, cache: entry }));
}

const asPayload = (
  base: {
    game_id: string;
    failure_reason: string | null;
    exe_version: string | null;
    extension_version: string | null;
  },
  storeId: StoreId,
  install: InstallBlock,
): StoreGameVersionPayload =>
  storeId === "steam"
    ? { ...base, store: "steam", steam: install as SteamInstallBlock }
    : { ...base, store: "gog", gog: install as GogInstallBlock };

/** The cheap change key: the record with both game versions (the expensive fields)
    nulled out, so identity drift is visible without resolving versions. */
function stableKeyOf(gameId: number, record: InstallRecord): string {
  return storeGameVersionChangeKey(
    asPayload(
      {
        game_id: String(gameId),
        failure_reason: record.failureReason,
        exe_version: null,
        extension_version: null,
      },
      record.storeId,
      record.install,
    ),
  );
}

/**
 * Submits the store_game_version telemetry event for ONE game's store install.
 * A no-op unless the user consented to analytics and is logged in, the game is a Nexus
 * game, and it was discovered through the steam or gog store. Installs are gated by a
 * cheap identity check, so only games whose store install changed ever reach the game
 * version lookups. Fire and forget: failures are logged, never thrown, so the
 * deployment that triggered this never depends on it.
 */
export async function emitStoreGameVersionEvent(
  api: IExtensionApi,
  internalGameId: string,
): Promise<void> {
  const state = api.getState();
  if (!isTelemetryEnabled(state) || !isLoggedIn(state)) {
    return;
  }

  const gameId = numericNexusGameId(internalGameId);
  if (gameId === null) {
    return;
  }

  const discovery = discoveryByGame(state, internalGameId);
  if (discovery?.path === undefined || (discovery.store !== "steam" && discovery.store !== "gog")) {
    return;
  }

  const record = await scanInstall(internalGameId, discovery);
  const stableKey = stableKeyOf(gameId, record);
  const cached = api.getState().persistent.analyticsTelemetry.storeGameVersions[internalGameId];
  if (cached !== undefined && cached.stableKey === stableKey) {
    return;
  }

  // the install identity moved; (re)read both game versions
  let exeVersion: string | null = null;
  let extensionVersion: string | null = null;
  try {
    ({ exe: exeVersion, extension: extensionVersion } = await readGameVersions(
      getGame(internalGameId),
      discovery,
    ));
  } catch (err) {
    log("debug", "store-game-version: game version lookup failed", {
      gameId: internalGameId,
      error: getErrorMessageOrDefault(err),
    });
  }

  const payload = asPayload(
    {
      game_id: String(gameId),
      // install identity problems outrank version lookup problems in failure_reason
      failure_reason:
        record.failureReason ?? (exeVersion === null ? "version-lookup-failed" : null),
      exe_version: exeVersion,
      extension_version: extensionVersion,
    },
    record.storeId,
    record.install,
  );

  const fullKey = storeGameVersionChangeKey(payload);
  // a failed lookup may be transient: leave the cheap gate open so the next emit
  // retries it, while the full key still dedupes a repeat of the same failure
  const gateKey = exeVersion === null ? null : stableKey;
  if (cached !== undefined && cached.fullKey === fullKey) {
    // only the volatile fields moved; refresh the cheap gate without a send
    refreshCache(api, internalGameId, { stableKey: gateKey, fullKey: cached.fullKey });
    return;
  }
  try {
    const res = await createVortexNexusV3InternalClient(api).telemetryEvent(
      uuid(),
      Temporal.Now.instant(),
      {
        type: "store_game_version",
        version: 1,
        payload,
      },
    );

    if (res.rejected.length > 0) {
      // a rejected event counts as a failed send: leave the cache for a retry
      log("warn", "store-game-version: telemetry event rejected", {
        gameId: internalGameId,
        rejected: res.rejected,
      });
      return;
    }

    refreshCache(api, internalGameId, { stableKey: gateKey, fullKey });
  } catch (err) {
    // a failed send leaves the cache untouched, so the next deploy retries
    log("warn", "store-game-version: telemetry submit failed", {
      error: getErrorMessageOrDefault(err),
    });
  }
}

/**
 * Submits the store_game_version event for every managed steam/gog install (the
 * games the user has profiles for), not just the game being deployed. Games run
 * one at a time: a mass update could otherwise fan out dozens of .info reads and
 * exe-version lookups at once.
 */
export async function emitStoreGameVersions(api: IExtensionApi): Promise<void> {
  const state = api.getState();
  const managedGameIds = new Set(
    Object.values(state.persistent.profiles).map((profile) => profile.gameId),
  );

  const candidates = Object.keys(discovered(state)).filter((gameId) => {
    if (!managedGameIds.has(gameId)) {
      return false;
    }
    const discovery = discoveryByGame(state, gameId);
    return (
      discovery?.path !== undefined && (discovery.store === "steam" || discovery.store === "gog")
    );
  });

  // sequential on purpose
  let chain = Promise.resolve();
  for (const gameId of candidates) {
    chain = chain.then(() =>
      emitStoreGameVersionEvent(api, gameId).catch((err) =>
        log("warn", "store-game-version: emit failed", {
          gameId,
          error: getErrorMessageOrDefault(err),
        }),
      ),
    );
  }
  return chain;
}
