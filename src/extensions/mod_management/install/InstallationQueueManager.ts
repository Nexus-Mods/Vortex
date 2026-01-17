/**
 * InstallationQueueManager - Manages installation queue operations.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Installation queuing with phase-gating
 * - Queue execution with concurrency limiting
 * - Cleanup of pending installations
 *
 * Installation flow:
 * 1. queueInstallation() - queues a dependency for installation
 * 2. startQueuedInstallation() - executes the queued installation
 * 3. cleanupPendingInstalls() - cleans up on completion/cancellation
 */

import Bluebird from "bluebird";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getBatchContext } from "../../../util/BatchContext";
import ConcurrencyLimiter from "../../../util/ConcurrencyLimiter";
import { ProcessCanceled, UserCanceled } from "../../../util/CustomErrors";
import { log } from "../../../util/log";
import { activeProfile, profileById } from "../../../util/selectors";
import { unknownToError } from "../../../shared/errors";
import { batchDispatch } from "../../../util/util";

import { setModEnabled } from "../../profile_management/actions/profiles";
import { setModAttribute } from "../actions/mods";
import type { IDependency } from "../types/IDependency";
import type { IModReference } from "../types/IMod";
import { findModByRef } from "../util/dependencies";
import { renderModReference } from "../util/modName";

import type { PhaseManager } from "./PhaseManager";
import type { InstallationTracker } from "./InstallationTracker";
import type { IActiveInstallation } from "./types/IInstallationEntry";
import { applyExtraFromRule as applyExtraFromRuleUtil } from "./DependencyPhaseHelpers";
import { checkModVariantsExist } from "./ModLookupService";
import { canStartInstallationTasks as canStartInstallationTasksUtil } from "./PhasedInstallCoordinator";

/**
 * Callbacks for InstallManager-specific behavior that InstallationQueueManager needs.
 */
export interface IInstallationQueueCallbacks {
  /** Install a mod with instructions UI */
  withInstructions(
    api: IExtensionApi,
    collectionName: string,
    modName: string,
    downloadTag: string,
    instructions: any,
    recommended: boolean,
    install: () => Bluebird<string>,
  ): Bluebird<string>;

  /** Perform the actual mod installation */
  installModAsync(
    reference: IModReference,
    api: IExtensionApi,
    downloadId: string,
    options: { choices?: any; patches?: any },
    fileList: any,
    gameId: string,
    allowAutoEnable: boolean,
    sourceModId: string,
  ): Bluebird<string>;

  /** Show dependency installation error */
  showDependencyError(
    api: IExtensionApi,
    sourceModId: string,
    message: string,
    err: Error,
    modReference: string,
  ): void;

  /** Get mod name from mod object */
  getModName(mod: any): string;
}

/**
 * Configuration for InstallationQueueManager
 */
export interface IInstallationQueueConfig {
  /** Maximum retry attempts for failed installations */
  maxRetries: number;
}

export const DEFAULT_QUEUE_CONFIG: IInstallationQueueConfig = {
  maxRetries: 3,
};

/**
 * InstallationQueueManager class - manages installation queuing and execution.
 */
export class InstallationQueueManager {
  private mApi: IExtensionApi;
  private mPhaseManager: PhaseManager;
  private mTracker: InstallationTracker;
  private mDependencyInstallsLimit: ConcurrencyLimiter;
  private mMainInstallsLimit: ConcurrencyLimiter;
  private mDependencyRetryCount: Map<string, number>;
  private mCallbacks: IInstallationQueueCallbacks;
  private mConfig: IInstallationQueueConfig;

  constructor(
    api: IExtensionApi,
    phaseManager: PhaseManager,
    tracker: InstallationTracker,
    dependencyInstallsLimit: ConcurrencyLimiter,
    mainInstallsLimit: ConcurrencyLimiter,
    callbacks: IInstallationQueueCallbacks,
    config: IInstallationQueueConfig = DEFAULT_QUEUE_CONFIG,
  ) {
    this.mApi = api;
    this.mPhaseManager = phaseManager;
    this.mTracker = tracker;
    this.mDependencyInstallsLimit = dependencyInstallsLimit;
    this.mMainInstallsLimit = mainInstallsLimit;
    this.mDependencyRetryCount = new Map();
    this.mCallbacks = callbacks;
    this.mConfig = config;
  }

  /**
   * Clean up pending and active installations for a specific source mod.
   */
  public cleanupPendingInstalls(
    sourceModId: string,
    hard: boolean = false,
  ): void {
    // Clean up pending and active installs via tracker
    this.mTracker.cleanupForSourceMod(sourceModId);

    // Clean up retry counters for this source mod
    const retryKeysToRemove = Array.from(
      this.mDependencyRetryCount.keys(),
    ).filter((key) => key.startsWith(`${sourceModId}:`));
    retryKeysToRemove.forEach((key) => this.mDependencyRetryCount.delete(key));

    if (hard) {
      this.mMainInstallsLimit.clearQueue();
      this.mDependencyInstallsLimit.clearQueue();
      this.mPhaseManager.deleteState(sourceModId);
    }
  }

  /**
   * Queue an installation to run asynchronously without blocking downloads.
   * Installers are gated by phase so higher phases won't start until lower phases finish.
   */
  public queueInstallation(
    api: IExtensionApi,
    dep: IDependency,
    downloadId: string,
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    phase: number = 0,
  ): void {
    this.mPhaseManager.ensureState(sourceModId);
    const phaseNum = phase ?? 0;

    // Check if this installation is already active or pending
    const installKey = this.mTracker.generateInstallKey(
      sourceModId,
      downloadId,
    );
    const alreadyActive = this.mTracker.hasActive(installKey);
    const alreadyPending = this.mTracker.hasPending(installKey);

    if (alreadyActive || alreadyPending) {
      return;
    }

    const startTask = () =>
      this.startQueuedInstallation(
        api,
        dep,
        downloadId,
        gameId,
        sourceModId,
        recommended,
        phaseNum,
      );

    const canStartTasks = canStartInstallationTasksUtil(this.mApi, sourceModId);

    // Only initialize allowedPhase early if we are allowed to run installers alongside downloads
    const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
    if (canStartTasks && allowedPhase === undefined) {
      this.mPhaseManager.setAllowedPhase(sourceModId, phaseNum);
      // When setting initial allowed phase, mark all previous phases as downloads finished
      for (let p = 0; p < phaseNum; p++) {
        this.mPhaseManager.markDownloadsFinished(sourceModId, p);
      }
    }

    const downloads = api.getState().persistent.downloads.files;
    const download = downloads[downloadId];
    const currentAllowedPhase =
      this.mPhaseManager.getAllowedPhase(sourceModId) ?? -1;
    const canStartNow = canStartTasks ? phaseNum <= currentAllowedPhase : false;

    // Don't start installations if deployment is in progress
    const canStartWithoutDeploymentBlock =
      canStartNow && !this.mPhaseManager.isDeploying(sourceModId);

    if (
      canStartWithoutDeploymentBlock &&
      download?.state === "finished" &&
      download?.size > 0
    ) {
      startTask();
    } else {
      if (this.mTracker.hasPending(installKey)) {
        return;
      }
      this.mTracker.setPending(installKey, dep);
      this.mPhaseManager.queuePending(sourceModId, phaseNum, startTask);
    }
  }

  /**
   * Starts a queued installation task and wires up phase accounting.
   */
  public startQueuedInstallation(
    api: IExtensionApi,
    dep: IDependency,
    downloadId: string,
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    phase: number,
  ): void {
    const installKey = this.mTracker.generateInstallKey(
      sourceModId,
      downloadId,
    );
    this.mTracker.setPending(installKey, dep);

    // Track active count for the phase
    this.mPhaseManager.incrementActive(sourceModId, phase);

    // Process installation immediately in parallel using concurrency limiter
    this.mDependencyInstallsLimit
      .do(async () => {
        const startTime = Date.now();

        // Track this dependency installation
        const depInstallInfo: IActiveInstallation = {
          installId: installKey,
          archiveId: downloadId,
          archivePath: "", // Will be updated when known
          modId: renderModReference(dep.reference),
          gameId,
          callback: () => {}, // Dependencies use different completion mechanism
          startTime,
          baseName: renderModReference(dep.reference),
        };
        this.mTracker.setActive(installKey, depInstallInfo);
        try {
          // Check if installation is still needed
          if (!this.mTracker.hasPending(installKey)) {
            this.mTracker.deleteActive(installKey);
            return;
          }

          const currentDep = this.mTracker.getPending(installKey);
          this.mTracker.deletePending(installKey);

          // Verify download is still finished before installing
          const downloads = api.getState().persistent.downloads.files;
          if (
            downloads[downloadId]?.state !== "finished" ||
            downloads[downloadId]?.size === 0
          ) {
            log("info", "Download no longer finished, skipping installation", {
              downloadId,
            });
            this.mTracker.deleteActive(installKey);
            return;
          }

          const sourceMod = api.getState().persistent.mods[gameId][sourceModId];
          // Check if mod is already installed with matching installer choices and patches
          const mods = api.getState().persistent.mods[gameId];
          const fullReference: IModReference = {
            ...currentDep.reference,
            installerChoices: currentDep.installerChoices,
            patches: currentDep.patches,
            fileList: currentDep.fileList,
          };
          const existingMod = findModByRef(fullReference, mods);
          const modId =
            existingMod != null
              ? existingMod.id
              : await this.mCallbacks.withInstructions(
                  api,
                  this.mCallbacks.getModName(sourceMod),
                  renderModReference(currentDep.reference),
                  currentDep.reference?.tag ?? downloadId,
                  currentDep.extra?.["instructions"],
                  recommended,
                  () =>
                    this.mCallbacks.installModAsync(
                      currentDep.reference,
                      api,
                      downloadId,
                      {
                        choices: currentDep.installerChoices,
                        patches: currentDep.patches,
                      },
                      currentDep.fileList,
                      gameId,
                      true,
                      sourceModId,
                    ),
                );

          if (modId) {
            this.mTracker.deleteActive(installKey);

            // Apply any extra attributes
            applyExtraFromRuleUtil(api, gameId, modId, {
              ...currentDep.extra,
              fileList: currentDep.fileList ?? currentDep.extra?.fileList,
              installerChoices: currentDep.installerChoices,
              patches: currentDep.patches ?? currentDep.extra?.patches,
            });

            const state = api.getState();

            const batchedActions = [];
            // Enable the mod only for the target profile to avoid affecting other profiles
            const batchContext = getBatchContext(
              [
                "install-dependencies",
                "install-collections",
                "install-recommendations",
              ],
              "",
            );
            const targetProfileId =
              batchContext?.get<string>("profileId") ??
              activeProfile(state)?.id;
            const targetProfile = targetProfileId
              ? profileById(state, targetProfileId)
              : undefined;

            if (targetProfile) {
              // Only modify the target profile - disable other variants and enable this one
              const otherModIds = checkModVariantsExist(
                api,
                gameId,
                downloadId,
              );
              for (const otherModId of otherModIds) {
                batchedActions.push(
                  setModEnabled(targetProfile.id, otherModId, false),
                );
              }
              batchedActions.push(setModEnabled(targetProfile.id, modId, true));
            } else {
              // Fallback: enable in profiles where source mod is enabled (original behavior)
              const profiles = Object.values(
                api.getState().persistent.profiles,
              ).filter(
                (prof) =>
                  prof.gameId === gameId &&
                  prof.modState?.[sourceModId]?.enabled,
              );
              profiles.forEach((prof) => {
                const otherModIds = checkModVariantsExist(
                  api,
                  gameId,
                  downloadId,
                );
                for (const otherModId of otherModIds) {
                  batchedActions.push(
                    setModEnabled(prof.id, otherModId, false),
                  );
                }
                batchedActions.push(setModEnabled(prof.id, modId, true));
              });
            }

            // Mark as installed as dependency
            batchedActions.push(
              setModAttribute(gameId, modId, "installedAsDependency", true),
            );
            batchDispatch(api.store, batchedActions);

            // Clear retry counter on successful installation
            this.mDependencyRetryCount.delete(installKey);
          }

          this.mTracker.deleteActive(installKey);
        } catch (unknownError) {
          this.mTracker.deleteActive(installKey);
          const currentRetryCount =
            this.mDependencyRetryCount.get(installKey) || 0;
          const isCanceled =
            unknownError instanceof UserCanceled ||
            unknownError instanceof ProcessCanceled;
          const hasRetriesLeft = currentRetryCount < this.mConfig.maxRetries;
          if (!isCanceled && hasRetriesLeft) {
            this.mTracker.setPending(installKey, dep); // Re-queue for potential retry
            this.mDependencyRetryCount.set(installKey, currentRetryCount + 1);
          } else {
            const err = unknownToError(unknownError);
            // Max retries exceeded, clean up and show error
            this.mDependencyRetryCount.delete(installKey);
            this.mCallbacks.showDependencyError(
              api,
              sourceModId,
              "Failed to install dependency",
              err,
              renderModReference(dep.reference),
            );
          }
          // Don't rethrow to avoid crashing the concurrency limiter
        } finally {
          // Always decrement phase active counter
          this.mPhaseManager.decrementActive(sourceModId, phase);
          // Note: Don't call maybeAdvancePhase here - it should only be called when phases are actually complete
        }
      })
      .catch((unknownError) => {
        const err = unknownToError(unknownError);
        this.mCallbacks.showDependencyError(
          api,
          sourceModId,
          "Critical error in dependency installation",
          err,
          renderModReference(dep.reference),
        );
        log("error", "Critical error in dependency installation", {
          downloadId,
          error: err.message,
          dependency: renderModReference(dep.reference),
        });
      });
  }
}
