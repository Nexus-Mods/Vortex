import type { GogInstall, StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { v4 as uuid } from "uuid";

import { setStoreGameVersionCache } from "@/extensions/analytics/actions/telemetry.action";
import type { IStoreGameVersionCacheEntry } from "@/extensions/analytics/types/telemetry";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import type { ISteamEntry } from "../../../util/Steam";
import { discoveryByGame, discovered } from "../../gamemode_management/selectors";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { readGameVersions } from "../../gamemode_management/util/getGameVersion";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/**
 * The gog install block from the raw goggame-<productId>.info content. The fields
 * are regexed off the raw text rather than passed through JSON.parse because build
 * ids exceed 2^53 and would be corrupted as JS numbers (per the contract notes).
 */
export function gogInstallFromInfo(raw: string, productId: string): GogInstall | null {
  const buildId = /"buildId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
  if (buildId === undefined) return null;

  // GOG writes the requested languages as a list of locale tags ("languages"); some
  // installers instead carry a scalar "language". Prefer the tag list.
  const language =
    /"languages"\s*:\s*\[\s*"([^"]+)"/.exec(raw)?.[1] ??
    /"language"\s*:\s*"([^"]+)"/.exec(raw)?.[1];

  return { product_id: productId, build_id: buildId, install_language: language ?? "" };
}

/**
 * Change-check hash for one payload. `state_flags` and `target_build_id` are stripped:
 * they flip on routine updates without the install identity changing (per MOD-12).
 */
export function storeGameVersionChangeKey(payload: StoreGameVersionPayload): string {
  const steam =
    payload.store === "steam"
      ? { ...payload.steam, state_flags: undefined, target_build_id: undefined }
      : undefined;
  return JSON.stringify([
    payload.game_id,
    payload.failure_reason,
    payload.exe_version,
    payload.extension_version,
    payload.store,
    steam,
  ]);
}

type SteamInstallBlock = Extract<StoreGameVersionPayload, { store: "steam" }>["steam"];
type GogInstallBlock = Extract<StoreGameVersionPayload, { store: "gog" }>["gog"];
type InstallBlock = SteamInstallBlock | GogInstallBlock;
type StoreId = "steam" | "gog";

/** Cache writes dispatch through the analytics reducer under
    persistent.analyticsTelemetry, which persists across Vortex sessions. */
function refreshCache(
  api: IExtensionApi,
  gameId: string,
  entry: IStoreGameVersionCacheEntry,
): void {
  api.store.dispatch(setStoreGameVersionCache({ gameId, cache: entry }));
}

/** Everything a game's store install contributes except the two game versions,
    the only expensive fields: failures carry their reason and `install` is null. */
interface InstallRecord {
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

/** Collect the store install identity for one game, from data that is cheap to
    read per deploy: store snapshots, manifest install data, GOG .info files. */
async function scanInstall(
  internalGameId: string,
  discovery: IDiscoveryResult,
): Promise<InstallRecord> {
  const storeId = discovery.store as StoreId;
  const game = getGame(internalGameId);
  const entries =
    getGameStoresSafe()
      .find((store) => store.id === storeId)
      ?.snapshot().entries ?? [];
  const entry =
    entries.find(
      (iter) => iter.gamePath !== undefined && normPath(iter.gamePath) === normPath(discovery.path),
    ) ??
    // the game variant Steam runs may deploy from a path different from its manifest's
    (game?.details?.steamAppId !== undefined
      ? entries.find((iter) => iter.appid === String(game?.details?.steamAppId))
      : undefined);

  if (entry === undefined) {
    return {
      storeId,
      install: null,
      failureReason: "store-entry-not-found",
    };
  }

  if (storeId === "gog") {
    let info: GogInstall | null = null;
    try {
      const blob = await window.api.fs.readFile(
        QualifiedPath.fromNative(entry.gamePath).join(`goggame-${entry.appid}.info`),
      );
      info = gogInstallFromInfo(new TextDecoder().decode(blob), entry.appid);
    } catch (err) {
      // a missing file just means Galaxy never wrote metadata for this install
      log("debug", "store-game-version: gog info file unreadable", {
        gamePath: entry.gamePath,
        error: getErrorMessageOrDefault(err),
      });
    }
    if (info === null) {
      return {
        storeId,
        install: null,
        failureReason: "info-parse-failed",
      };
    }
    return {
      storeId,
      install: info,
      failureReason: null,
    };
  }

  // steam: install data comes pre-parsed and zod-validated from the scan
  const data = (entry as ISteamEntry).installData;
  if (data === undefined) {
    return {
      storeId,
      install: null,
      failureReason: "acf-parse-failed",
    };
  }
  return {
    storeId,
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
