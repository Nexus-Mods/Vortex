import { classifyErrorCode } from "@vortex/shared";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { nexusIdsFromDownloadId } from "../../nexus_integration/selectors";
import type { ModAnalyticsIdentity } from "./MixpanelEvents";
import {
  ModsInstallationCancelledEvent,
  ModsInstallationCompletedEvent,
  ModsInstallationFailedEvent,
  ModsInstallationStartedEvent,
} from "./MixpanelEvents";
import { makeModAnalyticsIdentity } from "./modAnalyticsIdentity";

export type ModInstallOutcome = "completed" | "cancelled" | "failed";

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
export function emitModInstallStarted(api: IExtensionApi, archiveId: string): void {
  const identity = resolveModIdentity(api, archiveId);
  if (identity === undefined) {
    return;
  }
  api.events.emit("analytics-track-mixpanel-event", new ModsInstallationStartedEvent(identity));
}

/** Emits the terminal mods_installation_* event for the given outcome. "ignore" is not tracked. */
export function emitModInstallOutcome(
  api: IExtensionApi,
  archiveId: string,
  outcome: ModInstallOutcome,
  context: ModInstallOutcomeContext = {},
): void {
  const identity = resolveModIdentity(api, archiveId);
  if (identity === undefined) {
    return;
  }
  switch (outcome) {
    case "completed":
      api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationCompletedEvent({ ...identity, duration_ms: context.durationMs ?? 0 }),
      );
      break;
    case "cancelled":
      api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationCancelledEvent(identity),
      );
      break;
    case "failed":
      api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationFailedEvent({
          ...identity,
          error_code: classifyErrorCode(context.error),
          error_message: context.failReason ?? "unknown_error",
        }),
      );
      break;
  }
}
