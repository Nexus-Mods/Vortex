/**
 * PhasedInstallCoordinator - Utilities for coordinating phased mod installation.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Collection phase status checking
 * - Installation task eligibility checking
 * - Phase coordination utilities
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { getBatchContext } from "../../../util/BatchContext";
import { activeProfile, profileById } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";

import {
  getCollectionSessionById,
  getCollectionStatusBreakdown,
  isCollectionPhaseComplete,
} from "../../collections_integration/selectors";

import type { PhaseManager } from "./PhaseManager";
import type { InstallationTracker } from "./InstallationTracker";
import { getModsByPhase, getReadyDownloadId } from "./helpers";
import { generateCollectionSessionId } from "../../collections_integration/util";

/**
 * Result of checking a collection phase's status.
 */
export interface IPhaseStatusResult {
  /** Whether the phase is complete */
  phaseComplete: boolean;
  /** Whether there are mods that need to be re-queued */
  needsRequeue: boolean;
  /** All mods in the collection session */
  allMods: any[];
  /** Count of downloaded mods in this phase */
  downloadedCount: number;
  /** Count of mods that need to be re-queued */
  modsNeedingRequeue: number;
}

/**
 * Check the status of a collection phase.
 *
 * This examines the collection session state to determine:
 * - Whether the phase is complete
 * - How many mods are downloaded
 * - Whether any mods need to be re-queued for installation
 *
 * @param api - Extension API
 * @param sourceModId - ID of the source (collection) mod
 * @param phase - Phase number to check
 * @param phaseManager - Phase manager instance for cache access
 * @param hasActiveOrPending - Function to check if a download has active/pending installation
 * @param tracker - Optional tracker for additional checks (active/pending counts)
 * @returns Phase status result
 */
export function checkCollectionPhaseStatus(
  api: IExtensionApi,
  sourceModId: string,
  phase: number,
  phaseManager: PhaseManager,
  hasActiveOrPending: (sourceModId: string, downloadId?: string) => boolean,
  tracker?: InstallationTracker,
): IPhaseStatusResult {
  const state = api.getState();
  const batchContext = getBatchContext(
    ["install-dependencies", "install-recommendations"],
    "",
  );
  const profileId =
    batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
  const profile = profileById(state, profileId);
  const sessionId = generateCollectionSessionId(sourceModId, profile?.id);
  const activeCollectionSession = getCollectionSessionById(state, sessionId);

  if (!activeCollectionSession) {
    return {
      phaseComplete: true,
      needsRequeue: false,
      allMods: [],
      downloadedCount: 0,
      modsNeedingRequeue: 0,
    };
  }

  const mods = activeCollectionSession.mods || {};
  const allMods = Object.values(mods);
  const currentPhaseMods = getModsByPhase(allMods, phase);

  const phaseComplete = isCollectionPhaseComplete(api.getState(), phase);

  // Only count downloaded mods from the current phase being checked
  const allDownloadedMods = currentPhaseMods.filter(
    (mod: any) => mod.status === "downloaded",
  );
  const downloadedCount = allDownloadedMods.length;

  // Check if any downloaded mods actually need requeuing (don't have active/pending installations)
  const downloads = api.getState().persistent.downloads.files;
  let modsNeedingRequeue = 0;

  const hasCache = phaseManager.hasState(sourceModId);

  allDownloadedMods.forEach((mod: any) => {
    const reference = mod.rule?.reference;
    if (!reference) {
      return;
    }

    let downloadId: string | null = null;

    const md5Value = reference.md5Hint ?? reference.fileMD5;
    if (hasCache) {
      // Use cache for fast lookup
      if (reference.tag) {
        downloadId = phaseManager.getCachedDownloadByTag(
          sourceModId,
          reference.tag,
        );
      }
      if (!downloadId && md5Value) {
        downloadId = phaseManager.getCachedDownloadByMd5(sourceModId, md5Value);
      }
      if (!downloadId) {
        // This is probably a bundled mod - use full lookup
        downloadId = getReadyDownloadId(downloads, reference, (id) =>
          hasActiveOrPending(sourceModId, id),
        );
      }
      if (downloadId && !downloads[downloadId]) {
        // O(n) lookup if cached downloadId is invalid
        downloadId = getReadyDownloadId(downloads, reference, (id) =>
          hasActiveOrPending(sourceModId, id),
        );
      }
      if (downloadId && hasActiveOrPending(sourceModId, downloadId)) {
        downloadId = null; // Invalidate if already installing
      }
    } else {
      // Fallback to slow O(n) lookup if cache doesn't exist yet
      // This shouldn't happen often since cache is built as downloads finish
      downloadId = getReadyDownloadId(downloads, reference, (id) =>
        hasActiveOrPending(sourceModId, id),
      );
    }

    // If found, check if it's ready and not being installed
    if (downloadId) {
      const download = downloads[downloadId];
      const isReadyAndNotInstalling =
        download?.state === "finished" &&
        !hasActiveOrPending(sourceModId, downloadId);
      // Additional check: if tracker shows no active but has pending, also count as needing requeue
      const hasStuckPending =
        tracker !== undefined &&
        tracker.getActiveCount() === 0 &&
        tracker.getPendingCount() > 0;
      if (isReadyAndNotInstalling || hasStuckPending) {
        modsNeedingRequeue++;
      }
    }
  });

  const needsRequeue = modsNeedingRequeue > 0;
  return {
    phaseComplete,
    needsRequeue,
    allMods,
    downloadedCount,
    modsNeedingRequeue,
  };
}

/**
 * Check if installation tasks can be started for a collection.
 *
 * This respects the "install while downloading" setting and checks
 * whether there are pending downloads that would block installation.
 *
 * @param api - Extension API
 * @param sourceModId - ID of the source (collection) mod
 * @param allowOptional - Whether to include optional mods in the check
 * @returns True if installation tasks can be started
 */
export function canStartInstallationTasks(
  api: IExtensionApi,
  sourceModId: string,
  allowOptional?: boolean,
): boolean {
  const state = api.getState();
  const installWhileDownloading = getSafe(
    state,
    ["settings", "downloads", "collectionsInstallWhileDownloading"],
    false,
  );
  if (installWhileDownloading) {
    return true;
  }

  const batchContext = getBatchContext(
    ["install-dependencies", "install-recommendations"],
    "",
  );
  const profileId =
    batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
  const sessionId = generateCollectionSessionId(sourceModId, profileId);
  if (!sessionId) {
    // No active collection session, allow installations.
    return true;
  }

  const breakdown = getCollectionStatusBreakdown(state, sessionId);
  const relevant =
    allowOptional === true ? breakdown.total : breakdown.required;
  const pending = Object.entries(relevant).reduce((sum, [status, value]) => {
    if (["pending", "downloading"].includes(status)) {
      return sum + (value as number);
    }
    return sum;
  }, 0);

  return pending === 0;
}

/**
 * PhasedInstallCoordinator class - provides phase coordination utilities.
 *
 * This class wraps the standalone functions for cases where a class-based
 * interface is preferred, typically when managing state across multiple operations.
 */
export class PhasedInstallCoordinator {
  private mApi: IExtensionApi;
  private mPhaseManager: PhaseManager;
  private mTracker: InstallationTracker;

  constructor(
    api: IExtensionApi,
    phaseManager: PhaseManager,
    tracker: InstallationTracker,
  ) {
    this.mApi = api;
    this.mPhaseManager = phaseManager;
    this.mTracker = tracker;
  }

  /**
   * Check the status of a collection phase.
   */
  public checkPhaseStatus(
    sourceModId: string,
    phase: number,
  ): IPhaseStatusResult {
    return checkCollectionPhaseStatus(
      this.mApi,
      sourceModId,
      phase,
      this.mPhaseManager,
      (srcModId, downloadId) =>
        this.mTracker.hasActiveOrPending(srcModId, downloadId),
      this.mTracker,
    );
  }

  /**
   * Check if installation tasks can be started.
   */
  public canStartTasks(sourceModId: string, allowOptional?: boolean): boolean {
    return canStartInstallationTasks(this.mApi, sourceModId, allowOptional);
  }
}
