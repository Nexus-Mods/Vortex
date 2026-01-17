/**
 * PhaseCoordinator - Manages phase-gated collection installation coordination.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Phase polling and completion detection
 * - Phase advancement logic
 * - Re-queuing of downloaded mods
 * - Starting pending installations for phases
 *
 * See AGENTS-COLLECTIONS.md for architectural overview of phase invariants.
 */

import Bluebird from "bluebird";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IProfile, IState } from "../../../types/IState";
import { getBatchContext } from "../../../util/BatchContext";
import { log } from "../../../util/log";
import {
  activeGameId,
  activeProfile,
  profileById,
} from "../../../util/selectors";
import { toPromise } from "../../../util/util";

import {
  getCollectionActiveSession,
  getCollectionInstallProgress,
  isCollectionPhaseComplete,
} from "../../collections_integration/selectors";
import { findModByRef } from "../util/dependencies";
import type { IModReference } from "../types/IMod";

import type { PhaseManager } from "./PhaseManager";
import type { InstallationTracker } from "./InstallationTracker";
import type { DownloadEventHandler } from "./DownloadEventHandler";
import type { IInstallConfig } from "./types";
import {
  checkCollectionPhaseStatus as checkCollectionPhaseStatusUtil,
  canStartInstallationTasks as canStartInstallationTasksUtil,
} from "./PhasedInstallCoordinator";
import { getReadyDownloadId } from "./helpers";
import { findDownloadForMod } from "./ModLookupService";

/**
 * Callbacks for InstallManager-specific behavior that PhaseCoordinator needs.
 */
export interface IPhaseCoordinatorCallbacks {
  /** Check if dependency installation is active for a source mod */
  isDependencyInstallActive(sourceModId: string): boolean;
  /** Schedule deployment when a phase settles */
  scheduleDeployOnPhaseSettled(
    api: IExtensionApi,
    sourceModId: string,
    phase: number,
    deployOnSettle?: boolean,
  ): Promise<void> | undefined;
  /** Clean up pending installations */
  cleanupPendingInstalls(sourceModId: string, all: boolean): void;
}

/**
 * Configuration for PhaseCoordinator
 */
export interface IPhaseCoordinatorConfig {
  /** Poll interval in milliseconds */
  pollIntervalMs: number;
}

export const DEFAULT_PHASE_COORDINATOR_CONFIG: IPhaseCoordinatorConfig = {
  pollIntervalMs: 500,
};

/**
 * PhaseCoordinator class - manages phase-gated collection installation coordination.
 */
export class PhaseCoordinator {
  private mApi: IExtensionApi;
  private mPhaseManager: PhaseManager;
  private mTracker: InstallationTracker;
  private mDownloadEventHandler: DownloadEventHandler;
  private mCallbacks: IPhaseCoordinatorCallbacks;
  private mConfig: IPhaseCoordinatorConfig;

  constructor(
    api: IExtensionApi,
    phaseManager: PhaseManager,
    tracker: InstallationTracker,
    downloadEventHandler: DownloadEventHandler,
    callbacks: IPhaseCoordinatorCallbacks,
    config: IPhaseCoordinatorConfig = DEFAULT_PHASE_COORDINATOR_CONFIG,
  ) {
    this.mApi = api;
    this.mPhaseManager = phaseManager;
    this.mTracker = tracker;
    this.mDownloadEventHandler = downloadEventHandler;
    this.mCallbacks = callbacks;
    this.mConfig = config;
  }

  /**
   * Poll until all phases are complete for a collection installation.
   */
  public pollAllPhasesComplete(
    api: IExtensionApi,
    sourceModId: string,
  ): Bluebird<void> {
    const pollMs = this.mConfig.pollIntervalMs;

    return new Bluebird<void>((resolve) => {
      const poll = () => {
        if (!this.mPhaseManager.hasState(sourceModId)) {
          log("debug", "Phase state cleared, all phases considered complete", {
            sourceModId,
          });
          return resolve();
        }

        // Check if the dependency installation has been cancelled
        if (!this.mCallbacks.isDependencyInstallActive(sourceModId)) {
          log("debug", "Dependency installation cancelled", { sourceModId });
          return resolve();
        }

        const collectionInstallProgress = getCollectionInstallProgress(
          api.getState(),
        );
        if (!collectionInstallProgress) {
          const activeCollection = getCollectionActiveSession(api.getState());
          if (!activeCollection) {
            log(
              "debug",
              "No active collection session, all phases considered complete",
              { sourceModId },
            );
            this.mCallbacks.cleanupPendingInstalls(sourceModId, true);
            return resolve();
          }
        }

        // Check for queued deployments
        const phaseState = this.mPhaseManager.getState(sourceModId);
        const deploymentPromises =
          phaseState?.deploymentPromises || new Map<number, Promise<void>>();
        const hasQueuedDeployments = deploymentPromises.size > 0;

        const allowedPhase =
          this.mPhaseManager.getAllowedPhase(sourceModId) ?? 0;

        if (collectionInstallProgress?.isComplete) {
          log("debug", "All phases complete", { sourceModId });
          return resolve();
        } else {
          const collectionStatus = checkCollectionPhaseStatusUtil(
            api,
            sourceModId,
            allowedPhase,
            this.mPhaseManager,
            (srcModId, downloadId) =>
              this.mTracker.hasActiveOrPending(srcModId, downloadId),
            this.mTracker,
          );

          const currentPhaseComplete = collectionStatus.phaseComplete;
          if (
            !currentPhaseComplete &&
            collectionStatus.needsRequeue &&
            !this.mTracker.hasActiveOrPending(sourceModId)
          ) {
            // Requeue downloaded mods if phase is not complete and there are no active installations
            this.reQueueDownloadedMods(
              api,
              sourceModId,
              collectionStatus.allMods,
              allowedPhase,
            );
          }
          if (
            !hasQueuedDeployments &&
            !this.mTracker.hasActiveOrPending(sourceModId)
          ) {
            if (this.mPhaseManager.isPhaseDeployed(sourceModId, allowedPhase)) {
              // Phase already deployed, maybe advance
              this.maybeAdvancePhase(sourceModId, api);
            } else {
              this.mCallbacks.scheduleDeployOnPhaseSettled(
                api,
                sourceModId,
                allowedPhase,
              );
            }
          }
          const canStartTasks = canStartInstallationTasksUtil(
            this.mApi,
            sourceModId,
          );
          const active = this.mTracker.getActiveCount();
          const pendingInstalls = this.mTracker.getPendingCount();
          if (canStartTasks) {
            const pending = this.mPhaseManager.getPendingCount(
              sourceModId,
              allowedPhase,
            );
            if (active === 0 && pending === 0) {
              if (pendingInstalls > 0) {
                this.maybeAdvancePhase(sourceModId, api);
              } else {
                this.reQueueDownloadedMods(
                  api,
                  sourceModId,
                  collectionStatus.allMods,
                  allowedPhase,
                );
              }
            } else if (active === 0 && pendingInstalls > 0) {
              this.startPendingForPhase(sourceModId, allowedPhase);
            }
          }
          setTimeout(poll, pollMs);
        }
      };

      poll();
    });
  }

  /**
   * Poll for phase settlement and trigger deployment when ready.
   */
  public pollPhaseSettlement(
    api: IExtensionApi,
    sourceModId: string,
    options: {
      phase?: number;
    },
  ): Bluebird<void> {
    const pollMs = this.mConfig.pollIntervalMs;

    let hasDeployed = false;
    return new Bluebird<void>((resolve) => {
      const poll = () => {
        if (!this.mPhaseManager.hasState(sourceModId)) {
          return resolve();
        }

        // Check if the dependency installation has been cancelled
        if (!this.mCallbacks.isDependencyInstallActive(sourceModId)) {
          log(
            "debug",
            "Stopping phase polling - dependency installation cancelled",
            { sourceModId },
          );
          return resolve();
        }

        // Determine which phase we're checking
        const allowedPhase =
          this.mPhaseManager.getAllowedPhase(sourceModId) ?? 0;
        const checkPhase = options.phase ?? allowedPhase;

        // Check collection completion status
        const collectionStatus = checkCollectionPhaseStatusUtil(
          api,
          sourceModId,
          checkPhase,
          this.mPhaseManager,
          (srcModId, downloadId) =>
            this.mTracker.hasActiveOrPending(srcModId, downloadId),
          this.mTracker,
        );
        const existing = this.mPhaseManager.getDeploymentPromise(
          sourceModId,
          checkPhase,
        );
        if (existing?.deployOnSettle && !hasDeployed) {
          // CRITICAL: Block new installations during deployment to prevent file conflicts.
          // Removing this check causes race conditions. See AGENTS-COLLECTIONS.md.
          this.mPhaseManager.setDeploying(sourceModId, true);

          // Deploy mods for this phase
          toPromise((cb) => api.events.emit("deploy-mods", cb))
            .then(() => {
              this.mPhaseManager.setDeploying(sourceModId, false);
              this.mPhaseManager.markPhaseDeployed(sourceModId, checkPhase);
              // Start any installations that were queued during deployment
              hasDeployed = true;
              setTimeout(poll, pollMs);
              resolve();
            })
            .catch((err) => {
              log("warn", "deploy-mods failed after phase settle", {
                sourceModId,
                phase: checkPhase,
                error: err?.message,
              });
              this.mPhaseManager.setDeploying(sourceModId, false);
              // Start any installations that were queued during deployment, even if deployment failed
              this.startPendingForPhase(sourceModId, checkPhase);
              resolve(); // Resolve anyway to avoid hanging
            });
        } else {
          if (collectionStatus.phaseComplete) {
            this.mPhaseManager.setDeploying(sourceModId, false);
            // Start any installations that were queued during deployment
            this.mPhaseManager.markPhaseDeployed(sourceModId, checkPhase);
            this.startPendingForPhase(sourceModId, checkPhase);
            this.maybeAdvancePhase(sourceModId, api);
            resolve();
          } else if (
            !collectionStatus.phaseComplete &&
            collectionStatus.needsRequeue &&
            !this.mTracker.hasActiveOrPending(sourceModId)
          ) {
            // Requeue downloaded mods if phase is not complete and there are no active installations
            this.reQueueDownloadedMods(
              api,
              sourceModId,
              collectionStatus.allMods,
              checkPhase,
            );
            // Continue polling after re-queue
            setTimeout(poll, pollMs);
          } else {
            if (
              this.mTracker.getActiveCount() === 0 &&
              this.mTracker.getPendingCount() > 0
            ) {
              // Start any pending installations if none are active
              this.startPendingForPhase(sourceModId, checkPhase);
            }
            setTimeout(poll, pollMs);
          }
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Re-queue downloaded mods that are ready for installation.
   */
  public reQueueDownloadedMods(
    api: IExtensionApi,
    sourceModId: string,
    allMods: any[],
    currentPhase: number,
  ): void {
    if (!this.mPhaseManager.hasState(sourceModId)) {
      return;
    }

    const downloads = api.getState().persistent.downloads.files;

    // Expand the filter to include mods that are downloaded OR have downloads available
    const allModsWithDetails = allMods.map((mod: any) => ({
      ...mod,
      downloadId: mod.rule?.reference
        ? findDownloadForMod(mod.rule.reference, downloads)
        : null,
    }));

    // Look for mods that are marked as 'downloaded' and ready to install
    // Do NOT include 'pending' mods as they are already queued for installation
    const allDownloadedMods = allModsWithDetails.filter((mod: any) => {
      const hasDownload = mod.downloadId !== null;
      const modPhase = mod.phase ?? 0;
      const isDownloaded = mod.status === "downloaded";

      // Allow mods from current phase or earlier phases that haven't been completed
      const isEligiblePhase = modPhase <= currentPhase;

      // Only requeue mods that are 'downloaded' status - pending mods are already queued
      return isEligiblePhase && isDownloaded && hasDownload;
    });

    const downloadedPhases = new Set<number>();
    let anyQueued = false;
    let anyMarkedSkipped = false;

    allDownloadedMods.forEach((mod: any) => {
      const modPhase = mod.phase ?? 0;
      downloadedPhases.add(modPhase);

      if (modPhase > currentPhase) {
        return; // Skip this mod, it will be processed when its phase is active
      }
      const downloadId = mod.downloadId;
      if (!downloadId) {
        if (mod.type === "recommends") {
          anyMarkedSkipped = true;
        }
        return; // Skip this mod
      }

      const downloadState = downloads[downloadId]?.state;
      log("debug", "Download state check", { downloadId, downloadState });
      if (downloads[downloadId].state === "finished") {
        const hasPendingOrActive = this.mTracker.hasActiveOrPending(
          sourceModId,
          downloadId,
        );

        // Check if mod is already installed with matching installer choices and patches
        const gameId = activeGameId(api.getState());
        const mods = api.getState().persistent.mods[gameId] ?? {};
        const fullReference: IModReference | undefined = mod.rule?.reference
          ? {
              ...mod.rule.reference,
              installerChoices:
                mod.rule.installerChoices ?? mod.rule.extra?.installerChoices,
              patches: mod.rule.extra?.patches,
              fileList: mod.rule.fileList ?? mod.rule.reference?.fileList,
            }
          : undefined;
        const existingMod = fullReference && findModByRef(fullReference, mods);

        log("debug", "Requeue check", {
          downloadId,
          hasPendingOrActive,
          modId: existingMod?.id,
        });
        if (!hasPendingOrActive && !existingMod) {
          log("info", "Requeuing download for installation", { downloadId });
          const success = this.mDownloadEventHandler.handleDownloadFinished(
            api,
            downloadId,
            sourceModId,
          );
          if (success) {
            anyQueued = true;
          } else {
            log(
              "debug",
              "Requeue failed - collection not currently installing",
              { downloadId },
            );
          }
        } else if (!hasPendingOrActive && existingMod) {
          const installKey = this.mTracker.generateInstallKey(
            sourceModId,
            downloadId,
          );
          this.mTracker.deletePending(installKey);
          this.mTracker.deleteActive(installKey);
          api.events.emit(
            "did-install-mod",
            gameId,
            downloadId,
            existingMod.id,
            existingMod.attributes,
          );
        } else {
          log("debug", "Download already has pending/active installation", {
            downloadId,
          });
        }
      } else {
        log("debug", "Download not in finished state", {
          downloadId,
          state: downloadState,
        });
      }
    });

    // If we marked optional mods as skipped, check if their phases are now complete
    const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId) ?? 0;
    if (anyMarkedSkipped) {
      const phasesToCheck = Array.from(downloadedPhases).filter(
        (p) => p <= allowedPhase,
      );
      phasesToCheck.forEach((checkPhase) => {
        const completion = isCollectionPhaseComplete(
          api.getState(),
          checkPhase,
        );

        // If all required mods are complete and phase not already deployed, schedule deployment
        if (
          completion &&
          !this.mPhaseManager.isPhaseDeployed(sourceModId, checkPhase)
        ) {
          // Schedule deployment which will mark the phase as deployed when it completes
          this.mCallbacks.scheduleDeployOnPhaseSettled(
            api,
            sourceModId,
            checkPhase,
          );
        }
      });
    }

    // Initialize or advance phase system if needed
    if (anyQueued) {
      const currentAllowedPhase =
        this.mPhaseManager.getAllowedPhase(sourceModId);
      if (currentAllowedPhase === undefined) {
        const lowestPhase = Math.min(...Array.from(downloadedPhases));
        this.mPhaseManager.setAllowedPhase(sourceModId, lowestPhase);
        downloadedPhases.forEach((p) =>
          this.mPhaseManager.markDownloadsFinished(sourceModId, p),
        );
        this.startPendingForPhase(sourceModId, lowestPhase);
        this.maybeAdvancePhase(sourceModId, api);
      } else {
        // Phase already initialized, just ensure downloads are marked and try to advance
        downloadedPhases.forEach((p) => {
          if (!this.mPhaseManager.hasDownloadsFinished(sourceModId, p)) {
            this.mPhaseManager.markDownloadsFinished(sourceModId, p);
          }
        });
        // Try to start any pending installations and advance phases
        this.startPendingForPhase(sourceModId, currentAllowedPhase);
        this.maybeAdvancePhase(sourceModId, api);
      }
    }
  }

  /**
   * Mark downloads for a phase as finished and potentially start installations.
   */
  public markPhaseDownloadsFinished(
    sourceModId: string,
    phase: number,
    api: IExtensionApi,
  ): void {
    this.mPhaseManager.ensureState(sourceModId);
    // PhaseManager.markDownloadsFinished handles setting allowedPhase if undefined
    // and marking previous phases as finished
    const wasFirstPhase =
      this.mPhaseManager.getAllowedPhase(sourceModId) === undefined;
    this.mPhaseManager.markDownloadsFinished(sourceModId, phase);

    if (wasFirstPhase) {
      this.startPendingForPhase(sourceModId, phase);
    }

    this.maybeAdvancePhase(sourceModId, api);
  }

  /**
   * Start pending installations for a specific phase.
   */
  public startPendingForPhase(sourceModId: string, phase: number): void {
    if (!this.mPhaseManager.hasState(sourceModId)) {
      // Phase state was cleaned up, nothing to start
      return;
    }

    if (!canStartInstallationTasksUtil(this.mApi, sourceModId)) {
      return;
    }

    // Drain queue for this phase and run all tasks
    const tasks = this.mPhaseManager.drainPending(sourceModId, phase);
    tasks.forEach((run) => run());
  }

  /**
   * Attempt to advance to the next phase if current phase is complete.
   */
  public maybeAdvancePhase(sourceModId: string, api: IExtensionApi): void {
    const state = this.mApi.getState();
    if (!this.mPhaseManager.hasState(sourceModId)) {
      // Phase state was cleaned up, nothing to advance
      return;
    }

    const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
    if (allowedPhase === undefined) {
      log("debug", "phase gating: awaiting first finished phase", {
        sourceModId,
      });
      return;
    }

    // Clean up inappropriate phase state - clear re-queue attempts for phases beyond allowed
    this.mPhaseManager.clearFutureReQueueAttempts(sourceModId);

    // Try to advance through finished phases where there are no active installs
    let curr = allowedPhase;
    while (
      this.mPhaseManager.hasDownloadsFinished(sourceModId, curr) &&
      this.mPhaseManager.getActiveCount(sourceModId, curr) === 0 &&
      this.mPhaseManager.getPendingCount(sourceModId, curr) === 0
    ) {
      // Check if the phase is actually complete according to collection session
      const collectionStatus = checkCollectionPhaseStatusUtil(
        api,
        sourceModId,
        curr,
        this.mPhaseManager,
        (srcModId, downloadId) =>
          this.mTracker.hasActiveOrPending(srcModId, downloadId),
        this.mTracker,
      );
      if (!collectionStatus.phaseComplete) {
        this.startPendingForPhase(sourceModId, curr);
        break;
      }

      // Determine previous finished phase (by order in downloadsFinished)
      const finished = this.mPhaseManager.getFinishedPhases(sourceModId);
      const currIdx = finished.findIndex((p) => p === curr);
      // Only advance past curr if the current phase has been deployed
      if (!this.mPhaseManager.isPhaseDeployed(sourceModId, curr)) {
        log(
          "debug",
          "phase gating: phase complete but not deployed, scheduling deployment",
          { sourceModId, currPhase: curr },
        );
        // Schedule deployment to mark the phase as deployed when it settles
        this.mCallbacks.scheduleDeployOnPhaseSettled(api, sourceModId, curr);
        // Start any pending installations for this phase to avoid deadlocks
        this.startPendingForPhase(sourceModId, curr);
        break;
      }
      // Start any pending installs for this phase (if not already started)
      this.startPendingForPhase(sourceModId, curr);
      // Move to next finished phase if any
      const nextIdx = currIdx + 1;
      if (nextIdx < finished.length) {
        curr = finished[nextIdx];
        this.mPhaseManager.setAllowedPhase(sourceModId, curr);
        this.startPendingForPhase(sourceModId, curr);

        // When advancing to a new phase, scan for any finished downloads that should be queued
        this.scanAndQueueFinishedDownloadsForPhase(
          api,
          sourceModId,
          curr,
          state,
        );

        continue;
      }
      break;
    }
  }

  /**
   * Scan for finished downloads that should be queued when advancing to a new phase.
   */
  private scanAndQueueFinishedDownloadsForPhase(
    api: IExtensionApi,
    sourceModId: string,
    phase: number,
    state: IState,
  ): void {
    const apiState = api.getState();
    const batchContext = getBatchContext(
      ["install-dependencies", "install-recommendations"],
      "",
    );
    const profileId =
      batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
    const gameId = profileById(apiState, profileId)?.gameId;
    if (!gameId) {
      return;
    }
    const downloads = apiState.persistent.downloads.files;
    const mods = apiState.persistent.mods[gameId] || {};
    const collectionMod = mods[sourceModId];

    // We can't rely on the collection installation tracking for this since
    // the state might not be accurate if the app was restarted or if the
    // state has yet to be updated.
    if (collectionMod?.rules) {
      collectionMod.rules.forEach((rule: any) => {
        const rulePhase = rule.extra?.phase ?? 0;
        if (rulePhase === phase && rule.reference?.tag) {
          const downloadId = getReadyDownloadId(
            downloads,
            rule.reference,
            (id) => this.mTracker.hasActiveOrPending(sourceModId, id),
          );

          if (downloadId) {
            this.mDownloadEventHandler.handleDownloadFinished(
              api,
              downloadId,
              sourceModId,
            );
          }
        }
      });
    }
  }
}
