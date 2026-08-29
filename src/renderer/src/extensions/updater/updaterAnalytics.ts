import type { UpdaterState } from "@vortex/shared/ipc";

import type { IExtensionApi } from "../../types/IExtensionContext";
import {
  AppUpdateChannelChangedEvent,
  AppUpdateCheckCompletedEvent,
  AppUpdateDowngradeDecidedEvent,
  AppUpdateDownloadCompletedEvent,
  AppUpdateDownloadFailedEvent,
  AppUpdateDownloadStartedEvent,
  AppUpdateInstallStartedEvent,
  AppUpdateOfferedEvent,
  AppUpdateReleaseNotesViewedEvent,
  AppUpdatedEvent,
  type MixpanelEvent,
  type UpdateInstallSource,
  type UpdateReleaseNotesSource,
} from "../analytics/mixpanel/MixpanelEvents";

/**
 * Mixpanel events for the auto-updater, derived from the state machine.
 *
 * Transition events come from `onTransition(prev, next)`, called by the
 * updater extension once per state change (progress ticks and identical
 * re-renders are filtered out before it gets here). Button presses call the
 * small emitters. Everything goes over the analytics bus; consent is the
 * tracker's job (it queues anything emitted before it has started), so
 * nothing here checks it.
 */
export interface UpdaterAnalytics {
  onTransition(prev: UpdaterState | null, next: UpdaterState): void;
  appUpdated(fromVersion: string): void;
  installStarted(next: UpdaterState, source: UpdateInstallSource): void;
  downgradeDecided(toVersion: string, accepted: boolean): void;
  channelChanged(fromChannel: string, toChannel: string): void;
  releaseNotesViewed(toVersion: string, source: UpdateReleaseNotesSource): void;
}

export interface UpdaterAnalyticsDeps {
  api: IExtensionApi;
  currentVersion: () => string;
  channel: () => string;
  now?: () => number;
}

function isBusy(state: UpdaterState | null): boolean {
  return state?.type === "checking" || state?.type === "downloading";
}

export function createUpdaterAnalytics(deps: UpdaterAnalyticsDeps): UpdaterAnalytics {
  const now = deps.now ?? (() => Date.now());
  let downloadStartedAt: number | null = null;

  const emit = (event: MixpanelEvent) => {
    deps.api.events.emit("analytics-track-mixpanel-event", event);
  };
  const base = () => ({ update_channel: deps.channel() });

  const onTransition = (prev: UpdaterState | null, next: UpdaterState) => {
    // a check settled: report every manual outcome, and background failures
    // and offers; the background "nothing new" is left out on purpose, which
    // covers landing back on an already-staged update as well as finding
    // nothing (checks run 4-hourly, so neither is worth repeating forever)
    if (prev?.type === "checking" && next.type !== "checking") {
      const outcome =
        next.type === "error"
          ? "failed"
          : next.type === "idle" || next.type === "disabled"
            ? "up_to_date"
            : next.type === "staged"
              ? "already_staged"
              : "offered";
      const nothingNew = outcome === "up_to_date" || outcome === "already_staged";
      if (prev.manual || !nothingNew) {
        emit(
          new AppUpdateCheckCompletedEvent({
            manual: prev.manual,
            outcome,
            error_message: next.type === "error" ? next.message.slice(0, 200) : undefined,
            ...base(),
          }),
        );
      }
    }

    switch (next.type) {
      case "available":
      case "downgrade-offered": {
        emit(
          new AppUpdateOfferedEvent({
            from_version: deps.currentVersion(),
            to_version: next.version,
            kind: next.type === "downgrade-offered" ? "downgrade" : "update",
            manual: prev?.type === "checking" ? prev.manual : false,
            ...base(),
          }),
        );
        return;
      }
      case "downloading": {
        if (prev?.type === "downloading") {
          return; // percent tick, or the same download re-rendered
        }
        downloadStartedAt = now();
        // an auto patch download is the offer and the download in one
        if (prev?.type === "checking") {
          emit(
            new AppUpdateOfferedEvent({
              from_version: deps.currentVersion(),
              to_version: next.version,
              kind: next.kind,
              manual: prev.manual,
              ...base(),
            }),
          );
        }
        emit(
          new AppUpdateDownloadStartedEvent({
            to_version: next.version,
            kind: next.kind,
            manual: next.manual,
            ...base(),
          }),
        );
        return;
      }
      case "staged": {
        if (prev?.type !== "downloading") {
          return; // restored from disk by a check, not a download we watched
        }
        emit(
          new AppUpdateDownloadCompletedEvent({
            to_version: next.version,
            kind: next.kind,
            duration_ms: downloadStartedAt == null ? null : now() - downloadStartedAt,
            ...base(),
          }),
        );
        downloadStartedAt = null;
        return;
      }
      case "error": {
        if (prev?.type === "downloading") {
          emit(
            new AppUpdateDownloadFailedEvent({
              to_version: prev.version,
              kind: prev.kind,
              error_message: next.message.slice(0, 200),
              retry_offered: next.retry != null,
              ...base(),
            }),
          );
          downloadStartedAt = null;
        }
        return;
      }
      default:
        if (!isBusy(next)) {
          downloadStartedAt = null;
        }
    }
  };

  return {
    onTransition,
    appUpdated(fromVersion) {
      emit(
        new AppUpdatedEvent({
          from_version: fromVersion,
          to_version: deps.currentVersion(),
          ...base(),
        }),
      );
    },
    installStarted(state, source) {
      if (state.type !== "staged") {
        return;
      }
      emit(
        new AppUpdateInstallStartedEvent({
          to_version: state.version,
          kind: state.kind,
          source,
          ...base(),
        }),
      );
    },
    downgradeDecided(toVersion, accepted) {
      emit(
        new AppUpdateDowngradeDecidedEvent({
          from_version: deps.currentVersion(),
          to_version: toVersion,
          accepted,
          ...base(),
        }),
      );
    },
    channelChanged(fromChannel, toChannel) {
      emit(
        new AppUpdateChannelChangedEvent({
          from_channel: fromChannel,
          to_channel: toChannel,
          update_channel: toChannel,
        }),
      );
    },
    releaseNotesViewed(toVersion, source) {
      emit(new AppUpdateReleaseNotesViewedEvent({ to_version: toVersion, source, ...base() }));
    },
  };
}

/** True when a snapshot's state should be fed to onTransition (not a percent tick). */
export function isTransition(prev: UpdaterState | null, next: UpdaterState): boolean {
  if (prev == null) {
    return true;
  }
  if (prev.type === "downloading" && next.type === "downloading") {
    return prev.version !== next.version || prev.kind !== next.kind;
  }
  return (
    JSON.stringify({ ...prev, percent: undefined }) !==
    JSON.stringify({ ...next, percent: undefined })
  );
}
