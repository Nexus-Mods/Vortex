import { getErrorMessageOrDefault } from "@vortex/shared";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getApplication } from "../../../util/application";
import { log } from "../../../util/log";
import type { IMod } from "../../mod_management/types/IMod";
import { NEXUS_API_URL } from "../../nexus_integration/constants";
import { apiKey, userInfo } from "../../nexus_integration/selectors";
import { getOAuthTokenFromState } from "../../nexus_integration/util";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import { numericNexusGameId } from "../mixpanel/numericGameId";

/**
 * Reference to a related entity. Nexus REST API guidelines: relations are nested objects
 * (`user: { id }`) not flat `_id` fields, and every id is typed String, never a number.
 */
export interface EntityRef {
  id: string;
}

/**
 * One mod in a snapshot. All sources are supported: `source` is the mod's
 * `attributes.source` (nexus / site / generic / ...); `mod` and `file` carry the Nexus ids and
 * are null for mods that did not come from Nexus.
 */
export interface ModSnapshotEntry {
  source: string;
  mod: EntityRef | null;
  file: EntityRef | null;
  version: string | null;
  enabled: boolean;
}

/**
 * The LAZ-701 mod-list payload for one game. Sent as-is (a single JSON) to the ingest endpoint;
 * the ClickHouse side flattens `mods[]` into one row per mod. Shape follows the Nexus REST API
 * guidelines: related entities nested, all ids String.
 */
export interface ModListSnapshot {
  user: EntityRef;
  instance: EntityRef;
  game: EntityRef;
  captured_at: string;
  vortex_version: string;
  mods: ModSnapshotEntry[];
}

/** Ambient values the caller resolves (identity, timestamp, numeric game id). */
export interface ModListSnapshotMeta {
  userId: number;
  instanceId: string;
  capturedAt: string;
  vortexVersion: string;
  gameId: number;
}

// v3 ingest endpoint. Provisional path (renamed once the backend finalises it); the client is
// already functional against it the moment it exists.
const MOD_LIST_INGEST_URL = `${NEXUS_API_URL}/v3/telemetry/mod-lists`;

/** Nest an id as an entity reference, stringifying it. Null when the id is absent. */
function entityRef(id: number | string | undefined | null): EntityRef | null {
  return id === undefined || id === null ? null : { id: String(id) };
}

/**
 * Build the mod-list snapshot from a game's installed mods and the active profile's mod state.
 * Pure: the caller resolves `meta` and passes the mods + mod state read from persistence.
 */
export function buildModListSnapshot(
  mods: Record<string, IMod>,
  modState: Record<string, IProfileMod>,
  meta: ModListSnapshotMeta,
): ModListSnapshot {
  const entries = Object.values(mods)
    .filter((mod) => mod.state === "installed")
    .map((mod): ModSnapshotEntry => {
      const attributes = mod.attributes ?? {};
      return {
        source: attributes.source ?? "unknown",
        mod: entityRef(attributes.modId),
        file: entityRef(attributes.fileId),
        version: attributes.version ?? null,
        enabled: modState[mod.id]?.enabled ?? false,
      };
    });

  return {
    user: { id: String(meta.userId) },
    instance: { id: meta.instanceId },
    game: { id: String(meta.gameId) },
    captured_at: meta.capturedAt,
    vortex_version: meta.vortexVersion,
    mods: entries,
  };
}

/**
 * POST the snapshot to the v3 ingest endpoint, authenticated the same way as the generated v3
 * client (OAuth bearer token, else api key). Throws on a non-2xx response.
 */
async function sendModListSnapshot(api: IExtensionApi, snapshot: ModListSnapshot): Promise<void> {
  const state = api.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": `Vortex/${getApplication().version}`,
  };
  const bearerToken = getOAuthTokenFromState(api);
  const key = apiKey(state);
  if (bearerToken !== undefined) {
    headers["Authorization"] = `Bearer ${bearerToken}`;
  } else if (key !== undefined) {
    headers["apikey"] = key;
  }

  const response = await fetch(MOD_LIST_INGEST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(snapshot),
  });
  if (response?.ok !== true) {
    throw new Error(`mod-list ingest returned HTTP ${response?.status ?? "unknown"}`);
  }
}

/**
 * Build and send the mod-list snapshot for `internalGameId`, returning the snapshot that was
 * sent (or undefined when skipped). A no-op unless the user has consented to analytics, is
 * logged in, the game resolves to a numeric Nexus id, and an app instance id exists. Send errors
 * are logged, never thrown.
 */
export async function emitModListSnapshot(
  api: IExtensionApi,
  internalGameId: string,
): Promise<ModListSnapshot | undefined> {
  const state = api.getState();
  if (!isTelemetryEnabled(state)) {
    return undefined;
  }

  const userId = userInfo(state)?.userId;
  if (userId === undefined) {
    return undefined;
  }

  const gameId = numericNexusGameId(internalGameId);
  if (gameId === null) {
    return undefined;
  }

  const instanceId = state.app.instanceId;
  if (!instanceId) {
    return undefined;
  }

  const profileId = lastActiveProfileForGame(state, internalGameId);
  const modState = profileById(state, profileId)?.modState ?? {};
  const mods = state.persistent.mods[internalGameId] ?? {};

  const snapshot = buildModListSnapshot(mods, modState, {
    userId,
    instanceId,
    capturedAt: new Date().toISOString(),
    vortexVersion: getApplication().version,
    gameId,
  });

  try {
    await sendModListSnapshot(api, snapshot);
  } catch (err) {
    log("warn", "[modList] failed to send snapshot", {
      error: getErrorMessageOrDefault(err),
    });
  }

  return snapshot;
}
