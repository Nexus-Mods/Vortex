import type { internalComponents } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getApplication } from "../../../util/application";
import { log } from "../../../util/log";
import type { IMod, IModRepoId } from "../../mod_management/types/IMod";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { makeFileUID, makeModUID } from "../../nexus_integration/util/UIDs";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import { numericNexusGameId } from "../mixpanel/numericGameId";

// The request-body types are the ones generated from the vendored telemetry OpenAPI fragment, so
// the snapshot we build is checked against the endpoint's own schema (a backend shape change that
// regenerates the client breaks this build). `user_id` is not part of the body - the server reads
// it from the auth token.
export type ModEntry = internalComponents["schemas"]["ModEntry"];
export type ModListSnapshot = internalComponents["schemas"]["ModListSnapshot"];

/** Ambient values the caller resolves (install id, timestamp, version, numeric game id). */
export interface ModListSnapshotMeta {
  instanceId: string;
  capturedAt: string;
  vortexVersion: string;
  gameId: number;
}

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

/**
 * The Nexus mod/file UIDs ((gameId << 32) | id) for an installed mod, computed independently so a
 * Nexus mod keeps its `mod_id` even when `file_id` is missing. Null for non-Nexus / id-less mods.
 */
function nexusUIDs(
  gameId: number,
  attributes: { modId?: number; fileId?: number },
): { mod_id: string | null; file_id: string | null } {
  const repo: IModRepoId = {
    gameId: String(gameId),
    modId: hasValue(attributes.modId) ? String(attributes.modId) : undefined,
    fileId: hasValue(attributes.fileId) ? String(attributes.fileId) : "",
  };
  return {
    mod_id: hasValue(attributes.modId) ? ((makeModUID(repo) as string | undefined) ?? null) : null,
    file_id: hasValue(attributes.fileId)
      ? ((makeFileUID(repo) as string | undefined) ?? null)
      : null,
  };
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
    .map((mod): ModEntry => {
      const attributes = mod.attributes ?? {};
      return {
        source: attributes.source ?? "unknown",
        ...nexusUIDs(meta.gameId, attributes),
        version: attributes.version ?? null,
        enabled: modState[mod.id]?.enabled ?? false,
      };
    });

  return {
    instance_id: meta.instanceId,
    game_id: String(meta.gameId),
    captured_at: meta.capturedAt,
    vortex_version: meta.vortexVersion,
    mods: entries,
  };
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

  // The server derives the user id from the auth token, so we gate on being logged in with
  // credentials (bearer token or api key) rather than on a cached user id.
  if (!isLoggedIn(state)) {
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
  const mods = state.persistent.mods?.[internalGameId] ?? {};

  const snapshot = buildModListSnapshot(mods, modState, {
    instanceId,
    capturedAt: new Date().toISOString(),
    vortexVersion: getApplication().version,
    gameId,
  });

  try {
    await createVortexNexusV3InternalClient(api).submitModLists(snapshot);
  } catch (err) {
    log("warn", "[modList] failed to send snapshot", {
      error: getErrorMessageOrDefault(err),
    });
  }

  return snapshot;
}
