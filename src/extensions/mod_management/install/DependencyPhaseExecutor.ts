/**
 * DependencyPhaseExecutor - Executes a single phase of dependency installation.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module handles:
 * - Processing dependencies within a single phase
 * - Error handling for various failure scenarios
 * - Profile-aware mod enabling
 * - Post-installation cleanup and phase advancement
 */

import Bluebird from "bluebird";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getBatchContext } from "../../../util/BatchContext";
import {
  NotFound,
  ProcessCanceled,
  UserCanceled,
} from "../../../util/CustomErrors";
import { DownloadIsHTML } from "../../download_management/DownloadManager";
import { log } from "../../../util/log";
import { prettifyNodeErrorMessage } from "../../../util/message";
import { activeProfile, profileById } from "../../../util/selectors";
import { batchDispatch } from "../../../util/util";

import { setModEnabled } from "../../profile_management/actions/profiles";
import { setModAttribute } from "../actions/mods";
import type { IDependency } from "../types/IDependency";
import { renderModReference } from "../util/modName";

import { applyExtraFromRule as applyExtraFromRuleUtil } from "./DependencyPhaseHelpers";
import { dropUnfulfilled as dropUnfulfilledUtil } from "./DependencyPhaseHelpers";
import { checkModVariantsExist } from "./ModLookupService";
import { getReadyDownloadId } from "./helpers";

import type { PhaseManager } from "./PhaseManager";
import type { PhaseCoordinator } from "./PhaseCoordinator";
import type { InstallationTracker } from "./InstallationTracker";
import type { DownloadEventHandler } from "./DownloadEventHandler";
import type { InstallationQueueManager } from "./InstallationQueueManager";

/**
 * Callbacks for InstallManager-specific behavior that DependencyPhaseExecutor needs.
 */
export interface IDependencyPhaseCallbacks {
  /** Show dependency installation error notification */
  showDependencyError(
    api: IExtensionApi,
    sourceModId: string,
    title: string,
    messageOrError: string | Error,
    modReference: string,
    options?: { allowReport?: boolean; silent?: boolean },
  ): void;

  /** Get the abort function for a source mod's dependency installation */
  getDependencyAbort(sourceModId: string): (() => void) | undefined;

  /** Set the abort function for a source mod's dependency installation */
  setDependencyAbort(sourceModId: string, abort: () => void): void;

  /** Delete the dependency abort function for a source mod */
  deleteDependencyAbort(sourceModId: string): void;
}

/**
 * Configuration for DependencyPhaseExecutor
 */
export interface IDependencyPhaseConfig {
  /** Maximum concurrency for dependency installations within a phase */
  phaseConcurrency: number;
}

export const DEFAULT_PHASE_CONFIG: IDependencyPhaseConfig = {
  phaseConcurrency: 10,
};

/**
 * Type for the download callback passed to executePhase
 */
export type DoDownloadCallback = (
  dep: IDependency,
) => Bluebird<{ updatedDep: IDependency; downloadId: string }>;

/**
 * DependencyPhaseExecutor class - executes a single phase of dependency installation.
 */
export class DependencyPhaseExecutor {
  private mApi: IExtensionApi;
  private mPhaseManager: PhaseManager;
  private mPhaseCoordinator: PhaseCoordinator;
  private mTracker: InstallationTracker;
  private mDownloadEventHandler: DownloadEventHandler;
  private mInstallationQueueManager: InstallationQueueManager;
  private mCallbacks: IDependencyPhaseCallbacks;
  private mConfig: IDependencyPhaseConfig;

  constructor(
    api: IExtensionApi,
    phaseManager: PhaseManager,
    phaseCoordinator: PhaseCoordinator,
    tracker: InstallationTracker,
    downloadEventHandler: DownloadEventHandler,
    installationQueueManager: InstallationQueueManager,
    callbacks: IDependencyPhaseCallbacks,
    config: IDependencyPhaseConfig = DEFAULT_PHASE_CONFIG,
  ) {
    this.mApi = api;
    this.mPhaseManager = phaseManager;
    this.mPhaseCoordinator = phaseCoordinator;
    this.mTracker = tracker;
    this.mDownloadEventHandler = downloadEventHandler;
    this.mInstallationQueueManager = installationQueueManager;
    this.mCallbacks = callbacks;
    this.mConfig = config;
  }

  /**
   * Execute a single phase of dependency installation.
   */
  public executePhase(
    api: IExtensionApi,
    dependencies: IDependency[],
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    doDownload: DoDownloadCallback,
    abort: AbortController,
    silent: boolean,
  ): Bluebird<IDependency[]> {
    const res: Bluebird<IDependency[]> = Bluebird.map(
      dependencies,
      async (dep: IDependency) => {
        if (abort.signal.aborted) {
          return Bluebird.reject(new UserCanceled());
        }
        log("debug", "installing as dependency", {
          ref: dep.reference.logicalFileName,
          downloadRequired: dep.download === undefined,
        });

        const alreadyInstalled = dep.mod !== undefined;

        return (
          doDownload(dep)
            .then(({ updatedDep, downloadId }) => {
              const modId = updatedDep.mod?.id;
              if (modId == null) {
                // installation has been queued within doDownload, return
                //  the updated dependency so that the downloads can keep going.
                return Bluebird.resolve(updatedDep);
              }
              log("info", "installed as dependency", { modId });
              if (!alreadyInstalled) {
                api.store.dispatch(
                  setModAttribute(gameId, modId, "installedAsDependency", true),
                );
              }

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
                batchedActions.push(
                  setModEnabled(targetProfile.id, modId, true),
                );
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

              batchDispatch(api.store, batchedActions);

              applyExtraFromRuleUtil(api, gameId, modId, {
                ...dep.extra,
                fileList: dep.fileList ?? dep.extra?.fileList,
                installerChoices: dep.installerChoices,
                patches: dep.patches ?? dep.extra?.patches,
              });

              const mods = api.store.getState().persistent.mods[gameId];
              return { ...dep, mod: mods[modId] };
            })
            .catch((err) => {
              if (dep.extra?.onlyIfFulfillable) {
                dropUnfulfilledUtil(api, dep, gameId, sourceModId, recommended);
                return Bluebird.resolve(undefined);
              } else {
                return Bluebird.reject(err);
              }
            })
            // don't cancel the whole process if one dependency fails to install
            .catch(ProcessCanceled, (err) => {
              if (
                err.extraInfo !== undefined &&
                err.extraInfo.alreadyReported
              ) {
                return Bluebird.resolve(undefined);
              }
              const refName = renderModReference(dep.reference, undefined);
              const message =
                err.message +
                "\nA common cause for issues here is that the file may no longer " +
                "be available. You may want to install a current version of the specified mod " +
                "and update or remove the dependency for the old one.";
              this.mCallbacks.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                message,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch(DownloadIsHTML, () => {
              const refName = renderModReference(dep.reference, undefined);
              const message =
                "The direct download URL for this file is not valid or didn't lead to a file. " +
                "This may be a setup error in the dependency or the file has been moved.";
              this.mCallbacks.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                message,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch(NotFound, (err) => {
              const refName = renderModReference(dep.reference, undefined);
              this.mCallbacks.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                err,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch((err) => {
              const refName =
                dep.reference !== undefined
                  ? renderModReference(dep.reference, undefined)
                  : "undefined";
              if (err instanceof UserCanceled) {
                if (err.skipped) {
                  return Bluebird.resolve(undefined);
                } else {
                  abort.abort();
                  return Bluebird.reject(err);
                }
              } else if (err.code === "Z_BUF_ERROR") {
                this.mCallbacks.showDependencyError(
                  api,
                  sourceModId,
                  "Download failed",
                  "The download ended prematurely or was corrupted. You'll have to restart it.",
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );
              } else if ([403, 404, 410].includes(err["statusCode"])) {
                const message = `${err["message"]}\n\nThis error is usually caused by an invalid request, maybe you followed a link that has expired or you lack permission to access it.`;
                this.mCallbacks.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  message,
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );

                return Bluebird.resolve();
              } else if (err.code === "ERR_INVALID_PROTOCOL") {
                const msg = err.message.replace(/ Expected .*/, "");
                const message =
                  "The URL protocol used in the dependency is not supported, " +
                  "you may be missing an extension required to handle it:\n" +
                  msg;
                this.mCallbacks.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  message,
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );
              } else if (err.name === "HTTPError") {
                err["attachLogOnReport"] = true;
                this.mCallbacks.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  err,
                  refName,
                  {
                    allowReport: true,
                    silent,
                  },
                );
              } else {
                const pretty = prettifyNodeErrorMessage(err);
                this.mCallbacks.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  pretty as Error,
                  refName,
                  {
                    allowReport: pretty.allowReport,
                    silent,
                  },
                );
              }
              return Bluebird.resolve(undefined);
            })
            .then((updatedDependency: IDependency) => {
              if (updatedDependency === undefined) {
                return Bluebird.resolve(undefined);
              }
              log("debug", "done installing dependency", {
                ref: dep.reference.logicalFileName,
              });
              return Bluebird.resolve(updatedDependency);
            })
        );
      },
      { concurrency: this.mConfig.phaseConcurrency },
    )
      .finally(() => {
        // Process any pending installations that were queued during dependency installation
        const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
        if (
          this.mPhaseManager.hasState(sourceModId) &&
          allowedPhase !== undefined
        ) {
          this.mPhaseCoordinator.startPendingForPhase(
            sourceModId,
            allowedPhase,
          );

          // Scan for any finished downloads that haven't been queued yet
          // This handles downloads that were imported/finished before the collection started installing
          log("debug", "Scanning for unqueued finished downloads", {
            sourceModId,
          });
          const state = api.getState();
          const downloads = state.persistent.downloads.files;
          let foundCount = 0;
          dependencies.forEach((dep: IDependency) => {
            const downloadId = getReadyDownloadId(
              downloads,
              dep.reference,
              (id) => this.mTracker.hasActiveOrPending(sourceModId, id),
            );

            if (downloadId) {
              const rulePhase = dep.extra?.phase ?? 0;
              // Only process downloads for the current allowed phase or earlier
              if (rulePhase <= allowedPhase) {
                this.mDownloadEventHandler.handleDownloadFinished(
                  api,
                  downloadId,
                  sourceModId,
                );
                foundCount++;
              }
            }
          });
          log("debug", "Finished scanning for unqueued downloads", {
            sourceModId,
            foundCount,
          });

          this.mPhaseCoordinator.maybeAdvancePhase(sourceModId, api);
        }

        log("info", "done installing dependencies");
      })
      .catch(ProcessCanceled, (err) => {
        // This indicates an error in the dependency rules so it's
        // adequate to show an error but not as a bug in Vortex

        // Clean up phase state and dependency tracking when process is canceled
        this.mCallbacks.deleteDependencyAbort(sourceModId);
        this.mInstallationQueueManager.cleanupPendingInstalls(
          sourceModId,
          true,
        );

        api.showErrorNotification(
          "Failed to install dependencies",
          err.message,
          { allowReport: false },
        );
        return Bluebird.resolve([]);
      })
      .catch(UserCanceled, () => {
        log("info", "canceled out of dependency install");
        // Cancel all remaining operations when user cancels
        abort.abort();

        // Clean up phase state and dependency tracking when canceled
        this.mCallbacks.deleteDependencyAbort(sourceModId);
        this.mInstallationQueueManager.cleanupPendingInstalls(
          sourceModId,
          true,
        );

        api.sendNotification({
          id: "dependency-installation-canceled",
          type: "info",
          message: "Installation of dependencies canceled",
        });
        return Bluebird.resolve([]);
      })
      .catch((err) => {
        api.showErrorNotification("Failed to install dependencies", err);
        return Bluebird.resolve([]);
      })
      .filter((dep) => dep !== undefined);

    return Bluebird.resolve(res);
  }
}
