/**
 * DependencyInstallOrchestrator - Orchestrates dependency installation across phases.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module handles:
 * - Coordinating download and install operations for dependencies
 * - Managing download queuing and resume logic
 * - Phase initialization and execution
 * - Cleanup on abort or completion
 */

import Bluebird from "bluebird";
import * as path from "path";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import {
  NotFound,
  ProcessCanceled,
  UserCanceled,
} from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
import {
  downloadPathForGame,
  installPathForGame,
  knownGames,
} from "../../../util/selectors";
import { setdefault, truthy } from "../../../util/util";

import { setDownloadModInfo } from "../../../actions";
import { AlreadyDownloaded } from "../../download_management/DownloadManager";
import type { IDownload } from "../../download_management/types/IDownload";
import { convertGameIdReverse } from "../../nexus_integration/util/convertGameId";

import {
  getCollectionSessionById,
  isCollectionPhaseComplete,
} from "../../collections_integration/selectors";

import type { IDependency } from "../types/IDependency";
import type { IMod, IModReference } from "../types/IMod";
import modName, { renderModReference } from "../util/modName";
import { findDownloadByRef, findModByRef } from "../util/dependencies";

import { downloadDependencyAsync as downloadDependencyAsyncUtil } from "./DependencyDownloader";

import type { PhaseManager } from "./PhaseManager";
import type { PhaseCoordinator } from "./PhaseCoordinator";
import type { InstallationQueueManager } from "./InstallationQueueManager";
import type { DownloadEventHandler } from "./DownloadEventHandler";
import type { DependencyPhaseExecutor } from "./DependencyPhaseExecutor";

/**
 * Callbacks for InstallManager-specific behavior that DependencyInstallOrchestrator needs.
 */
export interface IDependencyOrchestratorCallbacks {
  /** Display mod installation with instructions UI */
  withInstructions(
    api: IExtensionApi,
    collectionName: string,
    modName: string,
    downloadTag: string,
    instructions: any,
    recommended: boolean,
    install: () => Bluebird<string>,
  ): Bluebird<string>;

  /** Install a mod asynchronously */
  installModAsync(
    reference: IModReference,
    api: IExtensionApi,
    downloadId: string,
    options: { choices?: any; patches?: any },
    fileList: any,
    gameId: string,
    silent: boolean,
    sourceModId: string,
  ): Bluebird<string>;

  /** Update a mod rule */
  updateModRule(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dep: IDependency,
    reference: IModReference,
    recommended: boolean,
  ): { reference: IModReference } | undefined;

  /** Get the abort function for a source mod */
  getDependencyAbort(sourceModId: string): (() => void) | undefined;

  /** Set the abort function for a source mod */
  setDependencyAbort(sourceModId: string, abort: () => void): void;

  /** Delete the dependency abort function */
  deleteDependencyAbort(sourceModId: string): void;
}

/**
 * Interface for concurrency limiters
 */
export interface IConcurrencyLimiter {
  do<T>(cb: () => PromiseLike<T> | T): PromiseLike<T>;
}

/**
 * Configuration for DependencyInstallOrchestrator
 */
export interface IDependencyOrchestratorConfig {
  /** Whether to enable detailed logging */
  verboseLogging: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: IDependencyOrchestratorConfig = {
  verboseLogging: false,
};

/**
 * DependencyInstallOrchestrator class - orchestrates dependency installation across phases.
 */
export class DependencyInstallOrchestrator {
  private mApi: IExtensionApi;
  private mPhaseManager: PhaseManager;
  private mPhaseCoordinator: PhaseCoordinator;
  private mPhaseExecutor: DependencyPhaseExecutor;
  private mDownloadEventHandler: DownloadEventHandler;
  private mInstallationQueueManager: InstallationQueueManager;
  private mDownloadsLimiter: IConcurrencyLimiter;
  private mInstallsLimiter: IConcurrencyLimiter;
  private mCallbacks: IDependencyOrchestratorCallbacks;
  private mConfig: IDependencyOrchestratorConfig;

  constructor(
    api: IExtensionApi,
    phaseManager: PhaseManager,
    phaseCoordinator: PhaseCoordinator,
    phaseExecutor: DependencyPhaseExecutor,
    downloadEventHandler: DownloadEventHandler,
    installationQueueManager: InstallationQueueManager,
    downloadsLimiter: IConcurrencyLimiter,
    installsLimiter: IConcurrencyLimiter,
    callbacks: IDependencyOrchestratorCallbacks,
    config: IDependencyOrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  ) {
    this.mApi = api;
    this.mPhaseManager = phaseManager;
    this.mPhaseCoordinator = phaseCoordinator;
    this.mPhaseExecutor = phaseExecutor;
    this.mDownloadEventHandler = downloadEventHandler;
    this.mInstallationQueueManager = installationQueueManager;
    this.mDownloadsLimiter = downloadsLimiter;
    this.mInstallsLimiter = installsLimiter;
    this.mCallbacks = callbacks;
    this.mConfig = config;
  }

  /**
   * Orchestrate the installation of dependencies across phases.
   */
  public orchestrate(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dependencies: IDependency[],
    recommended: boolean,
    silent: boolean,
  ): Bluebird<IDependency[]> {
    const state: IState = api.getState();
    let downloads: { [id: string]: IDownload } =
      state.persistent.downloads.files;

    const sourceMod = state.persistent.mods[gameId][sourceModId];
    const stagingPath = installPathForGame(state, gameId);

    if (sourceMod?.installationPath === undefined) {
      return Bluebird.resolve([]);
    }

    let queuedDownloads: IModReference[] = [];

    const clearQueued = () => {
      const downloadsNow = api.getState().persistent.downloads.files;
      // cancel in reverse order so that canceling a running download doesn't
      // trigger a previously pending download to start just to then be canceled too.
      queuedDownloads.reverse().forEach((ref) => {
        const dlId = findDownloadByRef(ref, downloadsNow);
        log("info", "cancel dependency dl", {
          name: renderModReference(ref),
          dlId,
        });
        if (dlId !== undefined) {
          api.events.emit("pause-download", dlId);
        } else {
          api.events.emit("intercept-download", ref.tag);
        }
      });
      queuedDownloads = [];

      this.mCallbacks.deleteDependencyAbort(sourceModId);
      this.mInstallationQueueManager.cleanupPendingInstalls(sourceModId, true);
    };

    const queueDownload = (dep: IDependency): Bluebird<string> => {
      return Bluebird.resolve(
        this.mDownloadsLimiter.do<string>(() => {
          if (dep.reference.tag !== undefined) {
            queuedDownloads.push(dep.reference);
          }
          return abort.signal.aborted
            ? Bluebird.reject(new UserCanceled(false))
            : downloadDependencyAsyncUtil(
                api,
                dep.reference,
                dep.lookupResults[0].value,
                () => abort.signal.aborted,
                dep.extra?.fileName,
              )
                .then((dlId) => {
                  const idx = queuedDownloads.indexOf(dep.reference);
                  queuedDownloads.splice(idx, 1);
                  return dlId;
                })
                .catch((err) => {
                  const idx = queuedDownloads.indexOf(dep.reference);
                  queuedDownloads.splice(idx, 1);

                  // Check if this is a network error that might have caused the download to be paused
                  const isNetworkError =
                    err.message?.includes("socket hang up") ||
                    err.message?.includes("ECONNRESET") ||
                    err.message?.includes("ETIMEDOUT") ||
                    err.code === "ECONNRESET" ||
                    err.code === "ETIMEDOUT";

                  // Check if this is a "File already downloaded" error
                  const isAlreadyDownloaded =
                    err instanceof AlreadyDownloaded ||
                    err.message?.includes("File already downloaded") ||
                    err.message?.includes("already downloaded");

                  if (isAlreadyDownloaded) {
                    if (err.downloadId !== undefined) {
                      log(
                        "info",
                        "File already downloaded, using existing download ID",
                        { downloadId: err.downloadId },
                      );
                      return Bluebird.resolve(err.downloadId);
                    }
                    // Try to find the download by filename
                    const currentDownloads =
                      api.getState().persistent.downloads.files;
                    const downloadId = Object.keys(currentDownloads).find(
                      (dlId) =>
                        currentDownloads[dlId].localPath === err.fileName ||
                        currentDownloads[dlId].modInfo?.referenceTag ===
                          dep.reference?.tag,
                    );

                    if (downloadId) {
                      log(
                        "info",
                        "Download already completed, using existing download",
                        { downloadId },
                      );
                      return Bluebird.resolve(downloadId);
                    } else {
                      // The download file exists but we can't find its record - refresh downloads
                      return new Bluebird((resolve) => {
                        api.events.emit("refresh-downloads", gameId, () => {
                          const currentDownloads =
                            api.getState().persistent.downloads.files;
                          const downloadId = Object.keys(currentDownloads).find(
                            (dlId) =>
                              currentDownloads[dlId].localPath === err.fileName,
                          );
                          return downloadId
                            ? resolve(downloadId)
                            : resolve(null);
                        });
                      });
                    }
                  }

                  if (isNetworkError) {
                    // For network errors, check if the download ended up in paused state
                    setTimeout(() => {
                      const currentDownloads =
                        api.getState().persistent.downloads.files;
                      const downloadId = Object.keys(currentDownloads).find(
                        (dlId) =>
                          currentDownloads[dlId].modInfo?.referenceTag ===
                          dep.reference?.tag,
                      );

                      if (
                        downloadId &&
                        currentDownloads[downloadId].state === "paused"
                      ) {
                        log(
                          "info",
                          "Network error resulted in paused download, will attempt resume",
                          {
                            downloadId,
                            error: err.message,
                          },
                        );
                      }
                    }, 1000);
                  }

                  return Bluebird.reject(err);
                });
        }),
      );
    };

    const resumeDownload = (dep: IDependency): Bluebird<string> => {
      return Bluebird.resolve(
        this.mDownloadsLimiter.do<string>(() =>
          abort.signal.aborted
            ? Bluebird.reject(new UserCanceled(false))
            : new Bluebird((resolve, reject) => {
                const currentDownloads =
                  api.getState().persistent.downloads.files;
                let resolvedId: string = dep.download;
                let currentDownload = currentDownloads[resolvedId];

                if (!currentDownload) {
                  // Try to resolve the download by referenceTag
                  const tag = dep.reference?.tag;
                  if (truthy(tag)) {
                    const foundId = Object.keys(currentDownloads).find(
                      (dlId) =>
                        currentDownloads[dlId]?.modInfo?.referenceTag === tag,
                    );
                    if (foundId) {
                      log(
                        "info",
                        "Resolved missing download id from referenceTag",
                        { from: dep.download, to: foundId, tag },
                      );
                      resolvedId = foundId;
                      currentDownload = currentDownloads[resolvedId];
                    }
                  }
                }

                if (!currentDownload) {
                  const readableRef = renderModReference(dep.reference);
                  log("warn", "Download not found when trying to resume", {
                    intendedId: dep.download,
                    ref: readableRef,
                  });
                  return reject(new NotFound(`download for ${readableRef}`));
                }

                if (currentDownload.state === "finished") {
                  log("info", "Download already finished, no need to resume", {
                    downloadId: resolvedId,
                  });
                  return resolve(resolvedId);
                }

                if (currentDownload.state !== "paused") {
                  log("info", "Download not in paused state", {
                    downloadId: resolvedId,
                    state: currentDownload.state,
                  });
                  return resolve(resolvedId);
                }

                log("info", "Resuming paused download", {
                  downloadId: resolvedId,
                  tag: dep.reference?.tag,
                });

                api.events.emit(
                  "resume-download",
                  resolvedId,
                  (err) => {
                    if (err !== null) {
                      if (
                        err.message?.includes("File already downloaded") ||
                        err.message?.includes("already downloaded")
                      ) {
                        log(
                          "info",
                          "Download already completed during resume attempt",
                          { downloadId: resolvedId },
                        );
                        return resolve(resolvedId);
                      }
                      reject(err);
                    } else {
                      resolve(resolvedId);
                    }
                  },
                  { allowInstall: false },
                );
              }),
        ),
      );
    };

    const installDownload = (
      dep: IDependency,
      downloadId: string,
    ): Bluebird<string> => {
      return new Bluebird<string>((resolve, reject) => {
        return this.mInstallsLimiter.do(async () => {
          return abort.signal.aborted
            ? reject(new UserCanceled(false))
            : this.mCallbacks
                .withInstructions(
                  api,
                  modName(sourceMod),
                  renderModReference(dep.reference),
                  dep.reference?.tag ?? downloadId,
                  dep.extra?.["instructions"],
                  recommended,
                  () =>
                    this.mCallbacks.installModAsync(
                      dep.reference,
                      api,
                      downloadId,
                      { choices: dep.installerChoices, patches: dep.patches },
                      dep.fileList,
                      gameId,
                      silent,
                      sourceModId,
                    ),
                )
                .then((res) => resolve(res))
                .catch((err) => {
                  if (err instanceof UserCanceled) {
                    err.skipped = true;
                  }
                  return reject(err);
                });
        });
      });
    };

    const doDownload = (
      dep: IDependency,
    ): Bluebird<{ updatedDep: IDependency; downloadId: string }> => {
      let dlPromise = Bluebird.resolve(dep.download);
      if (dep.download === undefined || downloads[dep.download] === undefined) {
        if (dep.extra?.localPath !== undefined) {
          // the archive is shipped with the mod that has the dependency
          const downloadPath = downloadPathForGame(state, gameId);
          const fileName = path.basename(dep.extra.localPath);
          let targetPath = path.join(downloadPath, fileName);
          // backwards compatibility: during alpha testing the bundles were 7zipped inside the collection
          if (path.extname(fileName) !== ".7z") {
            targetPath += ".7z";
          }
          dlPromise = fs
            .statAsync(targetPath)
            .then(() =>
              Object.keys(downloads).find(
                (dlId) => downloads[dlId].localPath === fileName,
              ),
            )
            .catch(
              (err) =>
                new Bluebird((resolve, reject) => {
                  api.events.emit(
                    "import-downloads",
                    [
                      path.join(
                        stagingPath,
                        sourceMod.installationPath,
                        dep.extra.localPath,
                      ),
                    ],
                    (dlIds: string[]) => {
                      if (dlIds.length > 0) {
                        api.store.dispatch(
                          setDownloadModInfo(
                            dlIds[0],
                            "referenceTag",
                            dep.reference.tag,
                          ),
                        );
                        resolve(dlIds[0]);
                      } else {
                        resolve();
                      }
                    },
                    true,
                  );
                }),
            );
        } else {
          // Always allow downloads to be queued - installations will be deferred if needed
          dlPromise =
            (dep.lookupResults[0]?.value?.sourceURI ?? "") === ""
              ? Bluebird.reject(
                  new ProcessCanceled("Failed to determine download url"),
                )
              : queueDownload(dep);
        }
      } else if (dep.download === null) {
        dlPromise = Bluebird.reject(
          new ProcessCanceled("Failed to determine download url"),
        );
      } else if (downloads[dep.download]?.state === "paused") {
        // Get fresh state to ensure accurate paused detection
        const freshDownloads = api.getState().persistent.downloads.files;
        if (freshDownloads[dep.download]?.state === "paused") {
          dlPromise = resumeDownload(dep);
        } else {
          dlPromise = Bluebird.resolve(dep.download);
        }
      }
      return dlPromise
        .catch(UserCanceled, (err) => {
          if (err.skipped) {
            this.mDownloadEventHandler.handleDownloadSkipped(
              api,
              sourceModId,
              dep,
            );
          }
          return Bluebird.reject(err);
        })
        .catch(AlreadyDownloaded, (err) => {
          if (err.downloadId !== undefined) {
            return Bluebird.resolve(err.downloadId);
          } else {
            const downloadId = Object.keys(downloads).find(
              (dlId) => downloads[dlId].localPath === err.fileName,
            );
            if (downloadId !== undefined) {
              return Bluebird.resolve(downloadId);
            }
          }
          return Bluebird.reject(
            new NotFound(`download for ${renderModReference(dep.reference)}`),
          );
        })
        .then((downloadId: string) => {
          // Get fresh state before checking if download is paused
          const freshDownloads = api.getState().persistent.downloads.files;
          if (
            downloadId !== undefined &&
            freshDownloads[downloadId]?.state === "paused"
          ) {
            return resumeDownload(dep);
          } else {
            return Bluebird.resolve(downloadId);
          }
        })
        .then((downloadId: string) => {
          downloads = api.getState().persistent.downloads.files;

          if (downloadId === undefined || downloads[downloadId] === undefined) {
            return Bluebird.reject(
              new NotFound(`download for ${renderModReference(dep.reference)}`),
            );
          }
          if (downloads[downloadId].state !== "finished") {
            // download not actually finished, may be paused
            return Bluebird.reject(new UserCanceled(true));
          }

          if (
            dep.reference.tag !== undefined &&
            downloads[downloadId].modInfo?.referenceTag !== undefined &&
            downloads[downloadId].modInfo?.referenceTag !== dep.reference.tag
          ) {
            // we can't change the tag on the download because that might break
            // dependencies on the other mod
            // instead we update the rule in the collection
            dep.reference = this.mCallbacks.updateModRule(
              api,
              gameId,
              sourceModId,
              dep,
              {
                ...dep.reference,
                fileList: dep.fileList,
                patches: dep.patches,
                installerChoices: dep.installerChoices,
                tag: downloads[downloadId].modInfo.referenceTag,
              },
              recommended,
            )?.reference;

            dep.mod = findModByRef(
              dep.reference,
              api.getState().persistent.mods[gameId],
            );
          } else {
            log("info", "downloaded as dependency", {
              dependency: dep.reference.logicalFileName,
              downloadId,
            });
          }

          return dep.mod == null
            ? Bluebird.resolve()
                .then(() => {
                  return Bluebird.resolve({ updatedDep: dep, downloadId });
                })
                .catch((err) => {
                  if (dep["reresolveDownloadHint"] === undefined) {
                    return Bluebird.reject(err);
                  }
                  const newState = api.getState();
                  const download =
                    newState.persistent.downloads.files[downloadId];

                  let removeProm = Bluebird.resolve();
                  if (download !== undefined) {
                    // Convert download game ID from Nexus domain ID to internal ID
                    const games = knownGames(newState);
                    const convertedGameId = convertGameIdReverse(
                      games,
                      download.game[0],
                    );
                    const pathGameId = convertedGameId || download.game[0];

                    const fullPath: string = path.join(
                      downloadPathForGame(newState, pathGameId),
                      download.localPath,
                    );
                    removeProm = fs.removeAsync(fullPath);
                  }

                  return removeProm
                    .then(() => dep["reresolveDownloadHint"]())
                    .then(() => doDownload(dep));
                })
            : Bluebird.resolve({ updatedDep: dep, downloadId });
        });
    };

    const phases: { [phase: number]: IDependency[] } = {};

    dependencies.forEach((dep) =>
      setdefault(phases, dep.phase ?? 0, []).push(dep),
    );

    // Initialize phase state immediately after determining what phases we have
    if (dependencies.length > 0) {
      this.mPhaseManager.ensureState(sourceModId);

      const phaseNumbers = Object.keys(phases)
        .map((p) => parseInt(p, 10))
        .sort((a, b) => a - b);
      const lowestPhase = phaseNumbers[0];

      // Check collection session to determine actual current phase
      const activeCollectionSession = getCollectionSessionById(
        api.getState(),
        sourceModId,
      );

      if (activeCollectionSession) {
        // Determine the highest completed phase from the collection session
        const mods = activeCollectionSession.mods || {};
        const allMods = Object.values(mods);

        // Find all phases that exist in the collection
        const allPhases = new Set<number>();
        allMods.forEach((mod: any) => {
          allPhases.add(mod.phase ?? 0);
        });

        // Find the highest phase where all required mods are complete
        let highestCompletedPhase = -1;
        Array.from(allPhases)
          .sort((a, b) => a - b)
          .forEach((phase) => {
            const isPhaseComplete = isCollectionPhaseComplete(
              api.getState(),
              phase,
            );

            if (isPhaseComplete) {
              highestCompletedPhase = phase;
            }
          });

        // Set allowed phase to the next phase after the highest completed one
        const nextPhaseAfterCompleted = highestCompletedPhase + 1;
        const effectiveStartPhase = Math.max(
          lowestPhase,
          nextPhaseAfterCompleted,
        );

        const currentAllowedPhase =
          this.mPhaseManager.getAllowedPhase(sourceModId);
        if (
          currentAllowedPhase === undefined ||
          currentAllowedPhase < effectiveStartPhase
        ) {
          this.mPhaseManager.setAllowedPhase(sourceModId, effectiveStartPhase);
          // When setting allowed phase, mark all previous phases as downloads finished
          for (let p = 0; p < effectiveStartPhase; p++) {
            this.mPhaseManager.markDownloadsFinished(sourceModId, p);
          }
        }
      } else if (
        this.mPhaseManager.getAllowedPhase(sourceModId) === undefined
      ) {
        // No active session, use the lowest phase from dependencies
        this.mPhaseManager.setAllowedPhase(sourceModId, lowestPhase);
        // When setting initial allowed phase, mark all previous phases as downloads finished
        for (let p = 0; p < lowestPhase; p++) {
          this.mPhaseManager.markDownloadsFinished(sourceModId, p);
        }
        log("info", "Set initial allowed phase", {
          sourceModId,
          allowedPhase: lowestPhase,
        });
      }

      // Mark all phases as having downloads (they will be processed)
      phaseNumbers.forEach((phase) => {
        this.mPhaseManager.markDownloadsFinished(sourceModId, phase);
      });
    }

    const abort = new AbortController();

    abort.signal.onabort = () => clearQueued();

    const phaseList = Object.values(phases);

    const res: Bluebird<IDependency[]> = Bluebird.reduce(
      phaseList,
      (prev: IDependency[], depList: IDependency[], idx: number) => {
        if (depList.length === 0) {
          return prev;
        }
        return this.mPhaseExecutor
          .executePhase(
            api,
            depList,
            gameId,
            sourceModId,
            recommended,
            doDownload,
            abort,
            silent,
          )
          .then((updated: IDependency[]) => {
            // Mark this phase's downloads as finished to allow its installers to run,
            // but do not wait for installations to complete before proceeding to next phase.
            const phaseNum = depList[0]?.phase ?? 0;
            this.mPhaseCoordinator.markPhaseDownloadsFinished(
              sourceModId,
              phaseNum,
              api,
            );
            return updated;
          })
          .then((updated: IDependency[]) => {
            // Schedule a deploy for this phase once its installers settle; don't block download progression
            // const phaseNum = depList[0]?.phase ?? 0;
            // const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
            // if (this.mPhaseManager.hasState(sourceModId) && (allowedPhase !== undefined) && (phaseNum === allowedPhase)) {
            //   this.mCallbacks.scheduleDeployOnPhaseSettled(api, sourceModId, phaseNum);
            // }
            return updated;
          })
          .then((updated: IDependency[]) => [].concat(prev, updated));
      },
      [],
    );

    this.mCallbacks.setDependencyAbort(sourceModId, () => {
      abort.abort();
    });

    return Bluebird.resolve(res)
      .then((deps: IDependency[]) => {
        return this.mPhaseCoordinator
          .pollAllPhasesComplete(api, sourceModId)
          .then(() => deps);
      })
      .finally(() => {
        this.mPhaseManager.deleteState(sourceModId);
      });
  }
}
