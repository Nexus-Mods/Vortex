import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IMod } from "../../mod_management/types/IMod";
import type { ReplaceChoice } from "../../mod_management/types/IReplaceChoice";
import { nexusIdsFromDownloadId } from "../../nexus_integration/selectors";
import { classifyErrorCode } from "./error-code";
import type { ModAnalyticsIdentity, ModInstallKind } from "./MixpanelEvents";
import {
  ModsInstallationCancelledEvent,
  ModsInstallationCompletedEvent,
  ModsInstallationFailedEvent,
  ModsInstallationStartedEvent,
} from "./MixpanelEvents";
import { makeModAnalyticsIdentity } from "./modAnalyticsIdentity";

export type ModInstallOutcome = "completed" | "cancelled" | "failed";

/**
 * Classifies an install for the mods_installation_* `install_kind`. Must be called with the mod
 * being replaced (if any) captured BEFORE it is removed - the replace/update path removes the old
 * mod before the new one installs, so state can no longer tell an update apart from a fresh install.
 *
 * `replaceChoice` is how the user resolved a name clash, when one occurred, and takes precedence:
 * "variant" installs a coexisting second copy, "replace" swaps the existing mod across all local
 * profiles. Absent a name conflict it falls back to the version relationship.
 */
export function classifyInstallKind(
  existingMod: IMod | undefined,
  installingFileId: number | undefined,
  replaceChoice?: ReplaceChoice,
): ModInstallKind {
  if (replaceChoice === "variant") {
    return "variant";
  }
  if (replaceChoice === "replace") {
    return "profile_replace";
  }
  if (existingMod === undefined) {
    return "fresh";
  }
  const prevFileId = existingMod.attributes?.fileId;
  return prevFileId != null && prevFileId === installingFileId ? "reinstall" : "version_update";
}

/** Extra context for a failed/completed install emit. */
export interface ModInstallOutcomeContext {
  /** Elapsed install time for the completed event. */
  durationMs?: number;
  /** The install error, classified into error_code on the failed event. */
  error?: unknown;
  /** Human-readable failure reason for the failed event's error_message. */
  failReason?: string;
}

/**
 * Resolves the per-mod analytics identity for an install archive, or undefined when the
 * install should not be tracked: no nexus fileId (manual/bundled mods), or the archive is
 * the collection container itself (the collection has its own installation events). A mod
 * installed as part of a collection carries that collection's id under
 * modInfo.nexus.parentCollectionId.
 */
function resolveModIdentity(
  api: IExtensionApi,
  archiveId: string,
): ModAnalyticsIdentity | undefined {
  const state = api.getState();
  const nexusIds = nexusIdsFromDownloadId(state, archiveId);
  const isCollection = nexusIds?.collectionSlug != null && nexusIds?.revisionId != null;
  if (nexusIds?.fileId == null || isCollection) {
    return undefined;
  }
  const download = state.persistent.downloads.files?.[archiveId];
  return makeModAnalyticsIdentity(nexusIds, download?.modInfo?.nexus?.parentCollectionId ?? null);
}

/** Emits mods_installation_started for a mod (standalone or collection member). */
export function emitModInstallStarted(
  api: IExtensionApi,
  archiveId: string,
  installKind: ModInstallKind,
): void {
  const identity = resolveModIdentity(api, archiveId);
  if (identity === undefined) {
    return;
  }
  api.events.emit(
    "analytics-track-mixpanel-event",
    new ModsInstallationStartedEvent({ ...identity, install_kind: installKind }),
  );
}

/** Emits the terminal mods_installation_* event for the given outcome. "ignore" is not tracked. */
export function emitModInstallOutcome(
  api: IExtensionApi,
  archiveId: string,
  outcome: ModInstallOutcome,
  installKind: ModInstallKind,
  context: ModInstallOutcomeContext = {},
): void {
  const identity = resolveModIdentity(api, archiveId);
  if (identity === undefined) {
    return;
  }
  const base = { ...identity, install_kind: installKind };
  switch (outcome) {
    case "completed":
      api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationCompletedEvent({ ...base, duration_ms: context.durationMs ?? 0 }),
      );
      break;
    case "cancelled":
      api.events.emit("analytics-track-mixpanel-event", new ModsInstallationCancelledEvent(base));
      break;
    case "failed":
      api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationFailedEvent({
          ...base,
          error_code: classifyErrorCode(context.error),
          error_message: context.failReason ?? "unknown_error",
        }),
      );
      break;
  }
}
