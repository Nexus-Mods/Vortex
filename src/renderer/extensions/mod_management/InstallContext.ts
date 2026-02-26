import {
  addNotification,
  dismissNotification,
  updateNotification,
} from "../../actions/notifications";
import { startActivity, stopActivity } from "../../actions/session";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { INotification } from "../../types/INotification";
import type { IState } from "../../types/IState";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import type { IPrettifiedError } from "../../util/message";
import { showError } from "../../util/message";
import { getSafe } from "../../util/storeHelper";
import {
  ModsInstallationCancelledEvent,
  ModsInstallationCompletedEvent,
  ModsInstallationFailedEvent,
  ModsInstallationStartedEvent,
} from "../analytics/mixpanel/MixpanelEvents";

import { setDownloadInstalled } from "../download_management/actions/state";
import type { NotificationAggregator } from "./NotificationAggregator";
import { getModType } from "../gamemode_management/util/modTypeExtensions";
import NXMUrl from "../nexus_integration/NXMUrl";
import { nexusIdsFromDownloadId } from "../nexus_integration/selectors";
import { makeModAndFileUIDs } from "../nexus_integration/util/UIDs";
import { setModsEnabled } from "../profile_management/actions/profiles";

import {
  addMod,
  removeMod,
  setModAttributes,
  setModInstallationPath,
  setModState,
  setModType,
} from "./actions/mods";
import type { IInstallContext, InstallOutcome } from "./types/IInstallContext";
import type { IMod, ModState } from "./types/IMod";
import getModName from "./util/modName";

import PromiseBB from "bluebird";
import * as path from "path";

class InstallContext implements IInstallContext {
  private mAddMod: (mod: IMod) => void;
  private mRemoveMod: (modId: string) => void;
  private mAddNotification: (notification: INotification) => void;
  private mUpdateNotification: (
    id: string,
    progress: number,
    message: string,
  ) => void;
  private mDismissNotification: (id: string) => void;
  private mShowError: (
    message: string,
    details?: any,
    allowReport?: boolean,
    replace?: { [key: string]: string },
  ) => void;
  private mSetModState: (id: string, state: ModState) => void;
  private mSetModAttributes: (
    id: string,
    attributes: { [key: string]: any },
  ) => void;
  private mSetModInstallationPath: (id: string, installPath: string) => void;
  private mSetModType: (id: string, modType: string) => void;
  private mEnableMod: (modId: string) => void;
  private mSetDownloadInstalled: (
    archiveId: string,
    gameId: string,
    modId: string,
  ) => void;
  private mStartActivity: (activityId: string) => void;
  private mStopActivity: (activityId: string) => void;
  private mAddedId: string;
  private mIndicatorId: string;
  private mGameId: string;
  private mArchiveId: string;
  private mInstallOutcome: InstallOutcome;
  private mFailReason: string;
  private mFailError: IPrettifiedError;
  private mIsEnabled: (modId: string) => boolean;
  private mIsDownload: (archiveId: string) => boolean;
  private mSilent: boolean = false;
  private mDidReportError: boolean = false;

  private mLastPhase: string;
  private mLastProgress: number;

  private mApi: IExtensionApi;
  private mStartTime: number;
  private mNotificationAggregator?: NotificationAggregator;
  private mSourceModId?: string;

  constructor(
    gameMode: string,
    api: IExtensionApi,
    silent: boolean,
    notificationAggregator?: NotificationAggregator,
    sourceModId?: string,
  ) {
    this.mStartTime = Date.now();
    this.mApi = api;
    this.mNotificationAggregator = notificationAggregator;
    this.mSourceModId = sourceModId;
    const store = api.store;
    const dispatch = store.dispatch;
    this.mAddMod = (mod) => dispatch(addMod(gameMode, mod));
    this.mRemoveMod = (modId) => dispatch(removeMod(gameMode, modId));
    this.mAddNotification = (notification) =>
      api.sendNotification(notification);
    this.mUpdateNotification = (
      id: string,
      progress: number,
      message: string,
    ) => dispatch(updateNotification(id, progress, message));
    this.mDismissNotification = (id) => dispatch(dismissNotification(id));
    this.mStartActivity = (activity: string) =>
      dispatch(startActivity("mods", "installing"));

    this.mStopActivity = (activity: string) =>
      dispatch(stopActivity("mods", "installing"));
    this.mShowError = (message, details?, allowReport?, replace?) => {
      this.mDidReportError = true;
      return showError(dispatch, message, details, {
        allowReport,
        replace,
        attachments: [
          {
            id: "log",
            type: "file",
            data: path.join(getVortexPath("userData"), "vortex.log"),
            description: "Vortex Log",
          },
        ],
      });
    };
    this.mLastProgress = 0;
    this.mSetModState = (id, state) =>
      dispatch(setModState(gameMode, id, state));
    this.mSetModAttributes = (modId, attributes) => {
      Object.keys(attributes).forEach((attributeId) => {
        if (attributes[attributeId] === undefined) {
          delete attributes[attributeId];
        }
      });
      if (Object.keys(attributes).length > 0) {
        dispatch(setModAttributes(gameMode, modId, attributes));
      }
    };
    this.mSetModInstallationPath = (id, installPath) =>
      dispatch(setModInstallationPath(gameMode, id, installPath));
    this.mSetModType = (id, modType) =>
      dispatch(setModType(gameMode, id, modType));
    this.mEnableMod = (modId: string) => {
      const state: IState = store.getState();
      const profileId = state.settings.profiles.lastActiveProfile[this.mGameId];
      return setModsEnabled(api, profileId, [modId], true);
    };
    this.mIsEnabled = (modId) => {
      const state: IState = store.getState();

      const profileId = state.settings.profiles.lastActiveProfile[this.mGameId];
      const profile = state.persistent.profiles[profileId];
      return getSafe(profile, ["modState", modId, "enabled"], false);
    };
    this.mSetDownloadInstalled = (archiveId, gameId, modId) => {
      dispatch(setDownloadInstalled(archiveId, gameId, modId));
    };
    this.mIsDownload = (archiveId) => {
      const state: IState = store.getState();
      return (
        archiveId !== null &&
        getSafe(
          state,
          ["persistent", "downloads", "files", archiveId],
          undefined,
        ) !== undefined
      );
    };
    this.mSilent = silent ?? false;
  }

  public startIndicator(id: string): void {
    log("info", "start mod install", { id });

    this.mLastProgress = 0;
    // TODO: we're adding even when silent but those "silent"
    // notifications aren't displayed.
    // This is hacky but notifications get used to track progress on some ops
    // to display in other locations
    // if (!this.mSilent) {
    this.mAddNotification({
      id: "install_" + id,
      title: "Installing {{ id }}",
      message: "Preparing",
      replace: { id },
      type: this.mSilent ? "silent" : "activity",
    });
    // }
    this.mIndicatorId = id;
    this.mInstallOutcome = undefined;
    this.mStartActivity(`installing_${id}`);
  }

  public stopIndicator(mod?: IMod): void {
    if (this.mIndicatorId === undefined) {
      return;
    }

    this.mDismissNotification("install_" + this.mIndicatorId);
    this.mStopActivity(`installing_${this.mIndicatorId}`);

    PromiseBB.delay(50).then(() => {
      if (!this.mDidReportError) {
        this.mDidReportError = true;
        const noti: INotification = this.outcomeNotification(
          this.mInstallOutcome,
          this.mIndicatorId,
          this.mIsEnabled(this.mAddedId),
          mod !== undefined ? getModName(mod) : this.mIndicatorId,
          mod,
        );
        if (noti != null) {
          // Route through aggregator if available and aggregating
          if (this.mNotificationAggregator && this.mSourceModId) {
            const aggregationId = `install-dependencies-${this.mSourceModId}`;
            if (this.mNotificationAggregator.isAggregating(aggregationId)) {
              this.mNotificationAggregator.addNotification(
                aggregationId,
                noti.type as "error" | "warning" | "info",
                noti.title,
                this.mFailError ?? noti.message,
                mod !== undefined ? getModName(mod) : this.mIndicatorId,
                {
                  allowReport: this.mFailError?.allowReport ?? true,
                  actions: noti.actions,
                },
              );
              return;
            }
          }
          // Fallback to direct notification
          this.mAddNotification(noti);
        }
      }
    });
  }

  public setProgress(phase: string, percent?: number) {
    if (
      percent === undefined ||
      this.mLastPhase !== phase ||
      Math.abs(percent - (this.mLastProgress ?? 0)) >= 5
    ) {
      this.mLastProgress = percent;
      this.mLastPhase = phase;
      this.mUpdateNotification("install_" + this.mIndicatorId, percent, phase);
    }
  }

  public startInstallCB(id: string, gameId: string, archiveId: string): void {
    this.mAddMod({
      id,
      type: "",
      archiveId,
      installationPath: id,
      state: "installing",
      attributes: {
        name: id,
        installTime: new Date().toString(),
      },
    });
    this.mAddedId = id;
    this.mGameId = gameId;
    this.mArchiveId = archiveId;

    // something happens with bundled mods?

    const nexusIds = nexusIdsFromDownloadId(this.mApi.getState(), archiveId);

    const isCollection =
      nexusIds?.collectionSlug != null && nexusIds?.revisionId != null;

    if (nexusIds?.fileId != null && !isCollection) {
      const { modUID, fileUID } = makeModAndFileUIDs(
        nexusIds.numericGameId.toString(),
        nexusIds.modId,
        nexusIds.fileId,
      );
      this.mApi.events.emit(
        "analytics-track-mixpanel-event",
        new ModsInstallationStartedEvent(
          nexusIds.modId,
          nexusIds.fileId,
          nexusIds.numericGameId,
          modUID,
          fileUID,
        ),
      );
    }
  }

  public finishInstallCB(
    outcome: InstallOutcome,
    info?: any,
    reason?: string,
    error?: IPrettifiedError,
  ): void {
    log("info", "finish mod install", {
      id: this.mIndicatorId,
      outcome,
    });
    if (outcome === "ignore") {
      // nop
    } else if (outcome === "success") {
      this.mSetModState(this.mAddedId, "installed");

      this.mSetModAttributes(this.mAddedId, {
        installTime: new Date(),
        category: info.category,
        version: info.version,
        fileId: info.fileId,
        newestFileId: info.fileId,
        changelog: info.changelog,
        endorsed: undefined,
        bugMessage: "",
        ...info,
      });

      if (this.mIsDownload(this.mArchiveId)) {
        this.mSetDownloadInstalled(
          this.mArchiveId,
          this.mGameId,
          this.mAddedId,
        );
      }
    } else {
      this.mFailReason = reason;
      this.mFailError = error;
      if (this.mAddedId !== undefined) {
        this.mRemoveMod(this.mAddedId);
      }
    }
    this.mInstallOutcome = outcome;
  }

  public setInstallPathCB(id: string, installPath: string) {
    const fileName = path.basename(installPath);
    log("info", "using install path", { id, installPath, fileName });
    this.mSetModInstallationPath(id, fileName);
  }

  public setModType(id: string, modType: string) {
    log("info", "determined mod type", { id, modType });
    this.mSetModType(id, modType);
  }

  public reportError(
    message: string,
    details?: string | Error,
    allowReport?: boolean,
    replace?: { [key: string]: string },
  ): void {
    log("error", "install error", { message, details, replace });

    // Use NotificationAggregator if available and aggregating for this source mod
    if (this.mNotificationAggregator && this.mSourceModId) {
      const aggregationId = `install-dependencies-${this.mSourceModId}`;
      if (this.mNotificationAggregator.isAggregating(aggregationId)) {
        // Pass the original details (Error or string) to preserve stack traces
        this.mNotificationAggregator.addNotification(
          aggregationId,
          "error",
          message,
          details || message,
          this.mAddedId || this.mIndicatorId || "unknown",
          { allowReport },
        );
        return;
      }
    }

    // Fallback to regular error reporting
    this.mShowError(message, details, allowReport, replace);
  }

  public progressCB(percent: number, file: string): void {
    log("debug", "install progress", { percent, file });
  }

  private outcomeNotification(
    outcome: InstallOutcome,
    id: string,
    isEnabled: boolean,
    modName: string,
    mod?: IMod,
  ): INotification {
    const type = mod !== undefined ? getModType(mod.type) : undefined;
    const typeName =
      type !== undefined &&
      type.options !== undefined &&
      type.options.name !== undefined
        ? type.options.name
        : "Mod";

    const nexusIds =
      mod?.archiveId != null
        ? nexusIdsFromDownloadId(this.mApi.getState(), mod.archiveId)
        : null;
    const isCollection =
      nexusIds?.collectionSlug != null && nexusIds?.revisionId != null;

    switch (outcome) {
      case "success":
        if (nexusIds?.fileId != null && !isCollection) {
          const { modUID, fileUID } = makeModAndFileUIDs(
            nexusIds.numericGameId.toString(),
            nexusIds.modId,
            nexusIds.fileId,
          );
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new ModsInstallationCompletedEvent(
              nexusIds.modId,
              nexusIds.fileId,
              nexusIds.numericGameId,
              modUID,
              fileUID,
              Date.now() - this.mStartTime,
            ),
          );
        }

        // TODO: bit of a hack, I'd prefer if we controlled this from the collections
        //   extension
        if (mod?.type === "collection" || this.mSilent) {
          return null;
        }

        return {
          id: `may-enable-${id}`,
          type: "success",
          message: modName,
          title: `${typeName} installed`,
          group: "mod-installed",
          displayMS: isEnabled ? 4000 : undefined,
          actions: isEnabled
            ? []
            : [
                {
                  title: "Enable All",
                  action: (dismiss) => {
                    this.mEnableMod(this.mAddedId);
                    dismiss();
                  },
                },
              ],
        };
      case "canceled":
        if (nexusIds?.fileId != null && !isCollection) {
          const { modUID, fileUID } = makeModAndFileUIDs(
            nexusIds.numericGameId.toString(),
            nexusIds.modId,
            nexusIds.fileId,
          );
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new ModsInstallationCancelledEvent(
              nexusIds.modId,
              nexusIds.fileId,
              nexusIds.numericGameId,
              modUID,
              fileUID,
            ),
          );
        }

        return {
          type: "info",
          title: "Installation canceled",
          message: modName,
          replace: { id },
          displayMS: 4000,
          localize: { message: false },
        };
      case "ignore":
        return null;
      default:
        if (nexusIds?.fileId != null && !isCollection) {
          const { modUID, fileUID } = makeModAndFileUIDs(
            nexusIds.numericGameId.toString(),
            nexusIds.modId,
            nexusIds.fileId,
          );
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new ModsInstallationFailedEvent(
              nexusIds.modId,
              nexusIds.fileId,
              nexusIds.numericGameId,
              modUID,
              fileUID,
              "",
              this.mFailReason ?? "unknown_error",
            ),
          );
        }

        return {
          type: "error",
          title: "{{id}} failed to install",
          message: this.mFailReason,
          replace: { id },
          localize: { message: false },
        };
    }
  }
}

export default InstallContext;
