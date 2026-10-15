import type { GogInstall, StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { v4 as uuid } from "uuid";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import type { ISteamEntry } from "../../../util/Steam";
import { discoveryByGame } from "../../gamemode_management/selectors";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
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

/** Last accepted change key per game, so an unchanged install is never re-sent. */
const lastAccepted = new Map<string, string>();

/** Forget what was accepted so the next request is sent even if unchanged. */
export function resetStoreGameVersionHash(): void {
  lastAccepted.clear();
}

/** Windows and POSIX disagree about separators and case; matches either way. */
const normPath = (value: string): string =>
  value
    .replace(/[/\\]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();

type SteamInstallBlock = Extract<StoreGameVersionPayload, { store: "steam" }>["steam"];
type GogInstallBlock = Extract<StoreGameVersionPayload, { store: "gog" }>["gog"];
type InstallBlock = SteamInstallBlock | GogInstallBlock;

const asPayload = (
  base: {
    game_id: string;
    failure_reason: string | null;
    exe_version: string | null;
    extension_version: string | null;
  },
  storeId: "steam" | "gog",
  install: InstallBlock,
): StoreGameVersionPayload =>
  storeId === "steam"
    ? { ...base, store: "steam", steam: install as SteamInstallBlock }
    : { ...base, store: "gog", gog: install as GogInstallBlock };

async function collectStoreGameVersion(
  internalGameId: string,
  gameId: number,
  discovery: IDiscoveryResult,
): Promise<StoreGameVersionPayload> {
  const game = getGame(internalGameId);
  const base = {
    game_id: String(gameId),
    failure_reason: null as string | null,
    exe_version: null as string | null,
    extension_version: (game?.version ?? null) as string | null,
  };

  try {
    base.exe_version = (await game?.getInstalledVersion?.(discovery)) ?? null;
  } catch (err) {
    log("debug", "store-game-version: exe version lookup failed", {
      gameId: internalGameId,
      error: getErrorMessageOrDefault(err),
    });
  }

  const entries =
    getGameStoresSafe()
      .find((store) => store.id === discovery.store)
      ?.snapshot().entries ?? [];
  const entry =
    entries.find(
      (iter) => iter.gamePath !== undefined && normPath(iter.gamePath) === normPath(discovery.path),
    ) ??
    // the game variant Steam runs may deploy from a path different from its manifest's
    (game?.details?.steamAppId !== undefined
      ? entries.find((iter) => iter.appid === String(game?.details?.steamAppId))
      : undefined);

  // install identity problems outrank version lookup problems in failure_reason
  const versionFailure = base.exe_version === null ? "version-lookup-failed" : null;

  if (entry === undefined) {
    return asPayload(
      { ...base, failure_reason: "store-entry-not-found" },
      discovery.store as "steam" | "gog",
      null,
    );
  }

  if (discovery.store === "gog") {
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
      return asPayload({ ...base, failure_reason: "info-parse-failed" }, "gog", null);
    }
    return asPayload({ ...base, failure_reason: versionFailure }, "gog", info);
  }

  // steam branch: install data comes pre-parsed and zod-validated from the scan
  const data = (entry as ISteamEntry).installData;
  if (data === undefined) {
    return asPayload({ ...base, failure_reason: "acf-parse-failed" }, "steam", null);
  }
  return asPayload({ ...base, failure_reason: versionFailure }, "steam", {
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
  });
}

/**
 * Submits the store_game_version telemetry event for one game's store install.
 * A no-op unless the user consented to analytics and is logged in, the game is a Nexus
 * game, and it was discovered through the steam or gog store. Fire and forget: failures
 * are logged, never thrown, so the deployment that triggered this never depends on it.
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

  const payload = await collectStoreGameVersion(internalGameId, gameId, discovery);

  const changeKey = storeGameVersionChangeKey(payload);
  if (lastAccepted.get(internalGameId) === changeKey) {
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

    lastAccepted.set(internalGameId, changeKey);

    if (res.accepted > 0 || res.rejected.length > 0)
      log("debug", "telemetry events send", {
        accepted: res.accepted,
        rejected: res.rejected.length,
      });
  } catch (err) {
    log("warn", "store-game-version: telemetry submit failed", {
      error: getErrorMessageOrDefault(err),
    });
  }
}
