import { classifyErrorCode } from "@vortex/shared";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type {
  CollectionInstallOutcomeProps,
  MixpanelEvent,
} from "../../analytics/mixpanel/MixpanelEvents";
import {
  CollectionsInstallationCancelledEvent,
  CollectionsInstallationCompletedEvent,
  CollectionsInstallationFailedEvent,
  CollectionsInstallationPausedEvent,
  CollectionsInstallationResumedEvent,
  CollectionsInstallationStartedEvent,
} from "../../analytics/mixpanel/MixpanelEvents";
import { setModAttribute } from "../../mod_management/actions/mods";
import { nexusIdsFromDownloadId } from "../../nexus_integration/selectors";

/**
 * Terminal outcome of a collection install. "paused" is resumable rather than a
 * terminal end: it emits its own event but is intentionally excluded from the
 * completed/failed/cancelled set so those reconcile as
 * started == completed + failed + cancelled.
 */
export type CollectionInstallOutcome = "completed" | "failed" | "cancelled" | "paused";

/** Identifies the collection whose install is being tracked. */
export interface CollectionInstallRef {
  /** Download id of the collection archive, for resolving nexus ids. */
  archiveId: string | undefined;
  /** Mod id of the collection meta-mod, where durable install markers are stored. */
  collectionModId: string | undefined;
  gameId: string | undefined;
}

/** Extra context for an outcome emit. */
export interface CollectionInstallOutcomeContext {
  /**
   * The single error from a postprocessing failure (applying collection mod rules threw).
   * Absent for member-install failures, which have no single error - their causes are on
   * the per-member mods_installation_failed events. Its presence selects failure_stage.
   */
  postprocessError?: Error;
  /** Why the install paused (user, logout, gamemode-changed); recorded on the paused event. */
  pauseTrigger?: string;
}

/**
 * Durable install markers, stored on the collection mod's persisted attributes so they
 * survive restarts and are independent of member-install counts (members can be
 * pre-satisfied by the user or another collection). `installStarted` present means the
 * install was started but not yet finished - i.e. a start()/resume() now is a RESUME.
 */
const INSTALL_STARTED_ATTR = "installStartedAt";
const PAUSE_COUNT_ATTR = "collectionPauseCount";
const RESUME_COUNT_ATTR = "collectionResumeCount";

interface InstallMarkers {
  installStartedAt?: number;
  pauseCount: number;
  resumeCount: number;
}

function readMarkers(api: IExtensionApi, ref: CollectionInstallRef): InstallMarkers {
  const { gameId, collectionModId } = ref;
  // Mod attributes are typed `{ [k: string]: any }`; read them as unknown and narrow, so the
  // markers stay typed (no `any` leaking out of the index access).
  const attrs: Record<string, unknown> =
    gameId != null && collectionModId != null
      ? (api.getState().persistent.mods?.[gameId]?.[collectionModId]?.attributes ?? {})
      : {};
  const num = (key: string): number | undefined => {
    const value = attrs[key];
    return typeof value === "number" ? value : undefined;
  };
  return {
    installStartedAt: num(INSTALL_STARTED_ATTR),
    pauseCount: num(PAUSE_COUNT_ATTR) ?? 0,
    resumeCount: num(RESUME_COUNT_ATTR) ?? 0,
  };
}

function setMarker(
  api: IExtensionApi,
  ref: CollectionInstallRef,
  key: string,
  value: unknown,
): void {
  if (ref.gameId == null || ref.collectionModId == null) {
    return;
  }
  api.store.dispatch(setModAttribute(ref.gameId, ref.collectionModId, key, value));
}

/**
 * Emits the start or resume event, distinguishing the two via the durable installStartedAt
 * marker (NOT member counts). A genuine first start (marker absent) anchors the marker; a resume
 * (marker present) bumps the resume counter. Both carry the full count snapshot, so the markers
 * are updated FIRST and then buildOutcomeProps reads them (and the just-created session). Must be
 * called after startInstallSession so the session snapshot is available.
 */
export function emitCollectionInstallStartOrResume(
  api: IExtensionApi,
  ref: CollectionInstallRef,
  timeStarted: number,
): void {
  if (ref.archiveId == null) {
    return;
  }
  const markers = readMarkers(api, ref);
  const isResume = markers.installStartedAt !== undefined;
  if (isResume) {
    setMarker(api, ref, RESUME_COUNT_ATTR, markers.resumeCount + 1);
  } else {
    // Genuine first start: anchor the durable timestamp (also the total-duration base).
    setMarker(api, ref, INSTALL_STARTED_ATTR, Date.now());
  }

  const props = buildOutcomeProps(api, ref, timeStarted);
  if (props === undefined) {
    return;
  }
  const event = isResume
    ? new CollectionsInstallationResumedEvent(props)
    : new CollectionsInstallationStartedEvent(props);
  api.events.emit("analytics-track-mixpanel-event", event);
}

/**
 * Builds the shared outcome/count props from the active install session and the durable
 * markers. Counts come from the session SSOT so the terminal events reconcile; pause/resume
 * and total duration come from the durable markers. Returns undefined when the collection
 * identity or session snapshot is unavailable. Must be read BEFORE finishInstallSession,
 * which moves the active session into history.
 */
function buildOutcomeProps(
  api: IExtensionApi,
  ref: CollectionInstallRef,
  timeStarted: number,
): CollectionInstallOutcomeProps | undefined {
  const state = api.getState();
  // Read the raw count fields off the active session directly; the memoized progress selector only
  // adds computed progress/percentages we don't emit.
  const session = state.session.collections.activeSession;
  if (session == null || ref.archiveId == null) {
    return undefined;
  }
  const nexusIds = nexusIdsFromDownloadId(state, ref.archiveId);
  const markers = readMarkers(api, ref);
  const now = Date.now();
  return {
    collection_id: nexusIds.collectionId,
    revision_id: nexusIds.revisionId,
    game_id: nexusIds.numericGameId,
    required_total: session.totalRequired,
    installed: session.installedCount,
    failed: session.failedCount,
    ignored: session.ignoredCount,
    optional: session.totalOptional,
    duration_ms: now - timeStarted,
    total_duration_ms: now - (markers.installStartedAt ?? timeStarted),
    pause_count: markers.pauseCount,
    resume_count: markers.resumeCount,
    was_resumed: markers.resumeCount > 0,
  };
}

/** Clears the durable install markers so a later reinstall of the same collection starts fresh. */
function clearMarkers(api: IExtensionApi, ref: CollectionInstallRef): void {
  setMarker(api, ref, INSTALL_STARTED_ATTR, undefined);
  setMarker(api, ref, PAUSE_COUNT_ATTR, undefined);
  setMarker(api, ref, RESUME_COUNT_ATTR, undefined);
}

/**
 * Emits the collection-install Mixpanel event for the given outcome. No-ops when the
 * session snapshot is unavailable. Call before finishInstallSession. A "paused" outcome
 * bumps the durable pause counter and keeps the markers (resumable); a real terminal
 * clears the markers after emitting.
 */
export function emitCollectionInstallOutcome(
  api: IExtensionApi,
  outcome: CollectionInstallOutcome,
  ref: CollectionInstallRef,
  timeStarted: number,
  context: CollectionInstallOutcomeContext = {},
): void {
  // Bump the pause counter first so the paused event reflects this pause.
  if (outcome === "paused") {
    setMarker(api, ref, PAUSE_COUNT_ATTR, readMarkers(api, ref).pauseCount + 1);
  }

  const props = buildOutcomeProps(api, ref, timeStarted);
  if (props === undefined) {
    return;
  }
  const emit = (event: MixpanelEvent) => api.events.emit("analytics-track-mixpanel-event", event);
  switch (outcome) {
    case "completed":
      emit(new CollectionsInstallationCompletedEvent(props));
      break;
    case "cancelled":
      emit(new CollectionsInstallationCancelledEvent(props));
      break;
    case "paused":
      emit(
        new CollectionsInstallationPausedEvent({
          ...props,
          trigger: context.pauseTrigger ?? "user",
        }),
      );
      break;
    case "failed": {
      // A postprocessing error is a single exception we can classify; member-install
      // failures have no single error (per-member causes live on mods_installation_failed).
      const isPostprocess = context.postprocessError !== undefined;
      emit(
        new CollectionsInstallationFailedEvent({
          ...props,
          failure_stage: isPostprocess ? "postprocessing" : "member_install",
          error_code: isPostprocess ? classifyErrorCode(context.postprocessError) : undefined,
        }),
      );
      break;
    }
  }

  // A real terminal ends the install; drop the durable markers so a reinstall starts fresh.
  // A pause is resumable, so its markers are kept.
  if (outcome !== "paused") {
    clearMarkers(api, ref);
  }
}
