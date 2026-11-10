import type { GogInstall, StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { v4 as uuid } from "uuid";

import { setStoreGameVersionCache } from "@/extensions/analytics/actions/telemetry.action";
import type { IStoreGameVersionCacheEntry } from "@/extensions/analytics/types/telemetry";
import { log } from "@/logging";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IGameStoreEntry } from "../../../types/IGameStoreEntry";
import { gogGameProductId } from "../../../util/GOGLauncher";
import type { ISteamEntry } from "../../../util/Steam";
import { normalizeStoreQuery } from "../../../util/storeQuery";
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

/** The game a goggame-<productId>.info belongs to: itself for a game, the game for a DLC. */
function gogRootGameId(raw: string): string | undefined {
  return /"rootGameId"\s*:\s*"?(\d+)"?/.exec(raw)?.[1];
}

/** The raw goggame-<productId>.info in the game folder; undefined when unreadable. */
async function readGogInfo(gamePath: string, productId: string): Promise<string | undefined> {
  try {
    const blob = await window.api.fs.readFile(
      QualifiedPath.fromNative(gamePath).join(`goggame-${productId}.info`),
    );
    return new TextDecoder().decode(blob);
  } catch (err) {
    // a missing file just means Galaxy never wrote metadata for this install
    log("debug", "store-game-version: gog info file unreadable", {
      gamePath,
      error: getErrorMessageOrDefault(err),
    });
    return undefined;
  }
}

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

const inFolder = (entry: IGameStoreEntry, folder: string): boolean =>
  entry.gamePath !== undefined && normPath(entry.gamePath) === normPath(folder);

/** The GOG install in the game's folder. Each DLC has its own entry there too, so the
    game's install is reported: named by the registry and, where the registry doesn't
    say, by the DLC's .info. */
async function scanGogInstall(
  discovery: IDiscoveryResult,
  entries: IGameStoreEntry[],
): Promise<InstallRecord> {
  const entry = entries.find((iter) => inFolder(iter, discovery.path));
  if (entry === undefined) {
    return { storeId: "gog", install: null, failureReason: "store-entry-not-found" };
  }

  let productId = gogGameProductId(entry);
  let raw = await readGogInfo(discovery.path, productId);
  const rootGameId = raw === undefined ? undefined : gogRootGameId(raw);
  if (rootGameId !== undefined && rootGameId !== productId) {
    productId = rootGameId;
    raw = await readGogInfo(discovery.path, productId);
  }
  const info = raw === undefined ? null : gogInstallFromInfo(raw, productId);
  if (info === null) {
    return { storeId: "gog", install: null, failureReason: "info-parse-failed" };
  }
  return { storeId: "gog", install: info, failureReason: null };
}

/** Collect the store install identity for one game, from data that is cheap to
    read per deploy: store snapshots, manifest install data, GOG .info files. */
export async function scanInstall(
  internalGameId: string,
  discovery: IDiscoveryResult,
): Promise<InstallRecord> {
  const storeId = discovery.store as StoreId;
  const entries =
    getGameStoresSafe()
      .find((store) => store.id === storeId)
      ?.snapshot().entries ?? [];
  if (storeId === "gog") {
    return scanGogInstall(discovery, entries);
  }

  const ownIds = gameSteamAppIds(getGame(internalGameId));
  const atPath = entries.filter((iter) => inFolder(iter, discovery.path));
  // tools like the Creation Kit install into the game's own folder, so the path alone
  // can match several manifests: the game's own app id decides between them
  const entry =
    atPath.find((iter) => ownIds.has(iter.appid)) ??
    atPath[0] ??
    // the game variant Steam runs may deploy from a path different from its manifest's
    entries.find((iter) => ownIds.has(iter.appid));

  if (entry === undefined) {
    return {
      storeId,
      install: null,
      failureReason: "store-entry-not-found",
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
