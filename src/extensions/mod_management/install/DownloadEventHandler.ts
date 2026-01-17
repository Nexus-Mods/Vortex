/**
 * DownloadEventHandler - Handles download completion events for collection installations.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Download finished/failed/skipped event handling
 * - Collection download tracking and queue management
 * - Integration with phased installation system
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { log } from "../../../util/log";
import { activeProfile } from "../../../util/selectors";

import {
  getCollectionActiveSession,
  getCollectionModByReference,
} from "../../collections_integration/selectors";
import type { IDownload } from "../../download_management/types/IDownload";

import type { IDependency } from "../types/IDependency";
import type { IMod, IModRule } from "../types/IMod";
import { renderModReference } from "../util/modName";
import { lookupFromDownload } from "../util/dependencies";
import testModReference from "../util/testModReference";

import type { PhaseManager } from "./PhaseManager";
import type { InstallationTracker } from "./InstallationTracker";
import type { NotificationAggregator } from "../NotificationAggregator";
import { findDownloadByReferenceTag } from "./helpers";

/**
 * Result from finding a collection that owns a download.
 */
export interface ICollectionDownloadInfo {
  collectionMod: IMod;
  matchingRule: IModRule;
  gameId: string;
}

/**
 * Find the collection that owns a download based on its metadata.
 *
 * This searches both the active collection session and mods with matching rules.
 *
 * @param state - Redux state
 * @param download - Download to find collection for
 * @param sourceModId - Optional source mod ID to search
 * @returns Collection info or null if not found
 */
export function findCollectionByDownload(
  state: IState,
  download: IDownload,
  sourceModId?: string,
): ICollectionDownloadInfo | null {
  const gameId = activeProfile(state)?.gameId;
  if (!gameId) {
    log("debug", "No active game profile", { downloadId: download.id });
    return null;
  }

  const activeCollection = getCollectionActiveSession(state);
  if (sourceModId != null && activeCollection == null) {
    const mods: { [modId: string]: IMod } = state.persistent.mods[gameId];
    const collectionMod = mods?.[sourceModId];
    if (!collectionMod || !download?.id) {
      log("debug", "No collection mod found for sourceModId", {
        downloadId: download.id,
        sourceModId,
      });
      return null;
    }

    const lookup = lookupFromDownload(download);

    // Download lookups will not hold any patch/filelist/installerChoices info.
    // Which is why in this case we want to ensure that we only match using regular reference fields.
    const matchingRule = collectionMod.rules.find((rule) => {
      const { patches, fileList, installerChoices, ...refWithoutExtras } =
        rule.reference;
      return testModReference(lookup, refWithoutExtras);
    });

    if (matchingRule) {
      return { collectionMod, matchingRule, gameId };
    }
  }

  // Get the current active collection installation
  if (!activeCollection?.collectionId) {
    log("debug", "No active collection installation found", {
      downloadId: download.id,
    });
    return null;
  }

  const matchingRule = getCollectionModByReference(state, {
    tag: download.modInfo?.referenceTag,
    fileMD5: download.fileMD5,
    fileId: download.modInfo?.fileId,
    logicalFileName: download.localPath,
  });
  if (!matchingRule) {
    log("debug", "No matching rule found in collection for download", {
      downloadId: download.id,
    });
    return null;
  }

  const collectionMod =
    state.persistent.mods[gameId]?.[activeCollection.collectionId];
  if (!collectionMod) {
    log("debug", "Collection mod not found in state", {
      gameId,
      collectionId: activeCollection.collectionId,
    });
    return null;
  }
  return { collectionMod, matchingRule: matchingRule.rule, gameId };
}

/**
 * Callbacks required by DownloadEventHandler to interact with InstallManager.
 *
 * This interface defines the contract between the handler and InstallManager,
 * allowing the handler to be tested independently.
 */
export interface IDownloadEventCallbacks {
  /**
   * Check if dependencies are being installed for a collection.
   */
  isDependencyInstalling: (collectionId: string) => boolean;

  /**
   * Queue a dependency for installation.
   */
  queueInstallation: (
    api: IExtensionApi,
    dependency: IDependency,
    downloadId: string,
    gameId: string,
    collectionId: string,
    recommended: boolean,
    phase: number,
  ) => void;

  /**
   * Mark downloads as finished for a phase.
   */
  markPhaseDownloadsFinished: (
    collectionId: string,
    phase: number,
    api: IExtensionApi,
  ) => void;

  /**
   * Try to advance to the next phase.
   */
  maybeAdvancePhase: (collectionId: string, api: IExtensionApi) => void;

  /**
   * Generate a unique key for dependency installation tracking.
   */
  generateInstallKey: (sourceModId: string, downloadId: string) => string;
}

/**
 * DownloadEventHandler - Handles download events for collection installations.
 *
 * This class processes download-finished, download-failed, and download-skipped
 * events to update collection installation progress and queue mod installations.
 */
export class DownloadEventHandler {
  private mPhaseManager: PhaseManager;
  private mTracker: InstallationTracker;
  private mNotificationAggregator: NotificationAggregator | null;
  private mCallbacks: IDownloadEventCallbacks;

  constructor(
    phaseManager: PhaseManager,
    tracker: InstallationTracker,
    notificationAggregator: NotificationAggregator | null,
    callbacks: IDownloadEventCallbacks,
  ) {
    this.mPhaseManager = phaseManager;
    this.mTracker = tracker;
    this.mNotificationAggregator = notificationAggregator;
    this.mCallbacks = callbacks;
  }

  /**
   * Handle a download finishing successfully.
   *
   * This method:
   * 1. Finds the collection that owns this download
   * 2. Caches the download in the phase manager
   * 3. Creates a dependency object
   * 4. Queues the mod for installation
   *
   * @param api - Extension API
   * @param downloadId - ID of the finished download
   * @param sourceModId - Optional source mod (collection) ID
   * @returns true if the download was handled, false otherwise
   */
  public handleDownloadFinished(
    api: IExtensionApi,
    downloadId: string,
    sourceModId?: string,
  ): boolean {
    const state = api.getState();
    const download = state.persistent.downloads.files[downloadId];

    if (!download || download.state !== "finished") {
      log("debug", "Skipping download - not found or not finished", {
        downloadId,
        state: download?.state,
      });
      return false;
    }

    // Check if this download is part of a collection installation
    const collectionInfo = findCollectionByDownload(
      state,
      download,
      sourceModId,
    );
    if (!collectionInfo) {
      return false;
    }

    const { collectionMod, matchingRule, gameId } = collectionInfo;
    const collectionId = collectionMod.id;
    if (process.env.NODE_ENV !== "production") {
      log("debug", "Found collection for download", {
        downloadId,
        collectionId,
      });
    }

    const isInstallingDependencies =
      this.mCallbacks.isDependencyInstalling(collectionId);
    const hasPhaseState = this.mPhaseManager.hasState(collectionId);

    if (!isInstallingDependencies && !hasPhaseState) {
      log(
        "debug",
        "Collection is not currently installing (no active dependency install or phase state)",
        { collectionId, downloadId },
      );
      return false;
    }

    if (hasPhaseState) {
      // Add this download to the cache
      if (download.modInfo?.referenceTag) {
        this.mPhaseManager.cacheDownloadByTag(
          collectionId,
          download.modInfo.referenceTag,
          downloadId,
        );
      }
      if (download.fileMD5) {
        this.mPhaseManager.cacheDownloadByMd5(
          collectionId,
          download.fileMD5,
          downloadId,
        );
      }
    }

    // Create a dependency object and queue the installation
    const dependency: IDependency = {
      extra: matchingRule.extra,
      reference: matchingRule.reference,
      lookupResults: [], // Will be populated if needed
      download: downloadId,
      phase: matchingRule.extra?.phase || 0,
      patches: matchingRule.extra?.patches ?? matchingRule.reference.patches,
      installerChoices: matchingRule.installerChoices,
      fileList: matchingRule.fileList ?? matchingRule.reference.fileList,
    };

    // Ensure the phase is marked as having downloads finished
    // This is needed when downloads complete after initial dependency processing
    if (hasPhaseState) {
      this.mCallbacks.markPhaseDownloadsFinished(
        collectionId,
        dependency.phase,
        api,
      );
    }

    // Queue the installation
    this.mCallbacks.queueInstallation(
      api,
      dependency,
      downloadId,
      gameId,
      collectionId,
      matchingRule.type === "recommends",
      dependency.phase,
    );
    return true;
  }

  /**
   * Handle a download failing.
   *
   * This method reports the failure via the notification aggregator
   * or a direct notification if the aggregator is not available.
   *
   * @param api - Extension API
   * @param downloadId - ID of the failed download
   */
  public handleDownloadFailed(api: IExtensionApi, downloadId: string): void {
    const state = api.getState();
    const download = state.persistent.downloads.files[downloadId];

    if (!download) {
      log("debug", "Skipping download failure - download not found", {
        downloadId,
      });
      return;
    }

    // Check if this download is part of a collection installation
    const collectionInfo = findCollectionByDownload(
      state,
      download,
      downloadId,
    );
    if (!collectionInfo) {
      return;
    }

    const { collectionMod, matchingRule } = collectionInfo;
    const collectionId = collectionMod.id;
    log("debug", "Found collection for failed download", {
      downloadId,
      collectionId,
    });

    // Check if we're currently in collection installation for this collection
    const isInstallingCollection =
      this.mCallbacks.isDependencyInstalling(collectionId) ||
      this.mPhaseManager.hasState(collectionId);

    if (!isInstallingCollection) {
      log(
        "debug",
        "Collection is not currently installing - ignoring download failure",
        { collectionId, downloadId },
      );
      return;
    }

    // Get the download error message
    const errorMessage =
      download.failCause?.message ||
      "Download failed due to network or server error";
    const modNameStr = renderModReference(matchingRule.reference);

    // Report the download failure via aggregated notifications for collections
    if (this.mNotificationAggregator) {
      this.mNotificationAggregator.addNotification(
        collectionId,
        "error",
        "Collection Download Failed",
        `Failed to download "${modNameStr}": ${errorMessage}`,
        modNameStr,
        { allowReport: false },
      );
    } else {
      // Fallback to direct notification if aggregator not available
      api.showErrorNotification(
        "Collection Download Failed",
        `Failed to download "${modNameStr}": ${errorMessage}`,
        {
          allowReport: false,
        },
      );
    }
  }

  /**
   * Handle a download being skipped.
   *
   * This removes any pending/active installation tracking for the dependency
   * and tries to advance the phase.
   *
   * @param api - Extension API
   * @param sourceModId - Collection mod ID
   * @param dep - The skipped dependency
   */
  public handleDownloadSkipped(
    api: IExtensionApi,
    sourceModId: string,
    dep: IDependency,
  ): void {
    if (!sourceModId || !dep) {
      return;
    }

    // Check if we're currently in collection installation for this collection
    const isInstallingCollection =
      this.mCallbacks.isDependencyInstalling(sourceModId) ||
      this.mPhaseManager.hasState(sourceModId);
    if (!isInstallingCollection) {
      log(
        "debug",
        "Collection is not currently installing - ignoring skipped download",
        { sourceModId },
      );
      return;
    }

    const downloads = api.getState().persistent.downloads.files;
    const dlId =
      dep.download ?? findDownloadByReferenceTag(downloads, dep.reference);
    if (dlId != null) {
      // Remove any active or pending installation for this dependency
      const installKey = this.mCallbacks.generateInstallKey(sourceModId, dlId);
      this.mTracker.deletePending(installKey);
      this.mTracker.deleteActive(installKey);
    }

    // Notify InstallDriver to update tracking status
    api.events.emit("collection-mod-skipped", dep.reference);

    // See if we can advance the phase
    this.mCallbacks.maybeAdvancePhase(sourceModId, api);
  }
}
