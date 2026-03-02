import type * as Redux from "redux";

import PromiseBB from "bluebird";
import * as path from "path";
import { generate as shortid } from "shortid";

import type { IDialogResult } from "../../types/IDialog";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type { RedownloadMode } from "./DownloadManager";
import type DownloadManager from "./DownloadManager";
import type { IChunk } from "./types/IChunk";
import type { IDownload, IDownloadOptions } from "./types/IDownload";
import type { IDownloadRemoveOptions } from "./types/IDownloadRemoveOptions";
import type { IDownloadResult } from "./types/IDownloadResult";
import type { IStartDownloadOptions } from "./types/IStartDownloadOptions";
import type { ProgressCallback } from "./types/ProgressCallback";

import {
  ProcessCanceled,
  TemporaryError,
  UserCanceled,
} from "../../util/CustomErrors";
import { withContext } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import { renderError, showError } from "../../util/message";
import * as selectors from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { flatten, setdefault, truthy, batchDispatch } from "../../util/util";
import { unknownToError } from "@vortex/shared";
import {
  ModsDownloadStartedClientEvent,
  ModsDownloadCompletedEvent,
  ModsDownloadFailedEvent,
  ModsDownloadCancelledEvent,
  CollectionsDownloadCompletedEvent,
  CollectionsDownloadCancelledEvent,
  CollectionsDownloadFailedEvent,
} from "../analytics/mixpanel/MixpanelEvents";
import { showURL } from "../browser/actions";
import { knownGames } from "../gamemode_management/selectors";
import { getGames } from "../gamemode_management/util/getGame";
import { nexusIdsFromDownloadId } from "../nexus_integration/selectors";
import { convertGameIdReverse } from "../nexus_integration/util/convertGameId";
import { makeModAndFileUIDs } from "../nexus_integration/util/UIDs";
import {
  downloadProgress,
  finishDownload,
  initDownload,
  pauseDownload,
  removeDownload,
  removeDownloadSilent,
  setDownloadFilePath,
  setDownloadModInfo,
  setDownloadPausable,
} from "./actions/state";
import { AlreadyDownloaded, DownloadIsHTML } from "./DownloadManager";
import { ensureDownloadsDirectory } from "./util/downloadDirectory";
import getDownloadGames from "./util/getDownloadGames";
import { finalizeDownload } from "./util/postprocessDownload";

function progressUpdate(
  store: Redux.Store<any>,
  dlId: string,
  received: number,
  total: number,
  chunks: IChunk[],
  chunkable: boolean,
  urls: string[],
  filePath: string,
  smallUpdate: boolean,
) {
  const state = store.getState();
  const download: IDownload = state.persistent.downloads.files[dlId];
  if (download === undefined) {
    // progress for a download that's no longer active
    return;
  }
  const updates: any[] = [];
  if ((total !== 0 && !smallUpdate) || chunks !== undefined) {
    if (received < 0) {
      log("warn", "invalid download progress", { received, total });
    }
    updates.push(downloadProgress(dlId, received, total, chunks, urls));
  }
  if (
    filePath !== undefined &&
    path.basename(filePath) !== download.localPath
  ) {
    updates.push(setDownloadFilePath(dlId, path.basename(filePath)));
  }
  if (chunkable !== undefined && chunkable !== download.pausable) {
    updates.push(setDownloadPausable(dlId, chunkable));
  }
  if (updates.length > 0) {
    batchDispatch(store.dispatch, updates);
  }
}

/**
 * connect the download manager with the main application through events
 *
 * @class DownloadObserver
 */
export class DownloadObserver {
  // time we allow a download to be intercepted. If it's too short we may end up
  // processing a download that was supposed to be canceled
  private static INTERCEPT_TIMEOUT = 60000;
  private static MAX_RESUME_ATTEMPTS = 3;
  private mApi: IExtensionApi;
  private mManager: DownloadManager;
  private mOnFinishCBs: { [dlId: string]: Array<() => PromiseBB<void>> } = {};
  private mInterceptedDownloads: Array<{ time: number; tag: string }> = [];
  private mResumeAttempts: { [downloadId: string]: number } = {};

  constructor(api: IExtensionApi, manager: DownloadManager) {
    this.mApi = api;
    const events = api.events;
    this.mManager = manager;

    events.on(
      "remove-download",
      (downloadId, callback?, options?: IDownloadRemoveOptions) =>
        this.handleRemoveDownload(downloadId, callback, options),
    );
    events.on("pause-download", (downloadId, callback?) =>
      this.handlePauseDownload(downloadId, callback),
    );
    events.on("resume-download", (downloadId, callback?, options?) =>
      this.handleResumeDownload(downloadId, callback, options),
    );
    events.on(
      "start-download",
      (urls, modInfo, fileName?, callback?, redownload?, options?) =>
        this.handleStartDownload(
          urls,
          modInfo,
          fileName,
          callback,
          redownload,
          options,
        ),
    );
    // this is a bit of a hack that lets callers intercept a queued download that was not started
    // yet (e.g. it may be waiting to ensure the download dir exists)
    // for this to work the modInfo of the download has to contain a referenceTag corresponding to
    // the tag passed here
    events.on("intercept-download", (tag) => {
      this.mInterceptedDownloads.push({ time: Date.now(), tag });
    });

    api.onStateChange(["persistent", "nexus", "userInfo"], (old, newValue) => {
      // Pause active downloads only on actual premium status change (not login/logout).
      // When user logs out, other handlers (e.g., collections) deal with pausing.
      if (
        old !== undefined &&
        newValue !== undefined &&
        old.isPremium !== newValue.isPremium
      ) {
        const state = api.getState();
        const activeDownloadsList = selectors.queueClearingDownloads(state);
        Object.keys(activeDownloadsList).forEach((dlId) => {
          this.handlePauseDownload(dlId);
        });
      }

      // Always adjust concurrent downloads limit based on current premium status
      manager.setMaxConcurrentDownloads(newValue?.isPremium === true ? 10 : 1);
    });
  }

  // enqueues an operation to be run when a download finishes
  private queueFinishCB(
    id: string,
    cb: () => PromiseBB<void>,
  ): PromiseBB<void> {
    return new PromiseBB((resolve) => {
      setdefault(this.mOnFinishCBs, id, []).push(() => cb().then(resolve));
    });
  }

  private wasIntercepted(tag: string): boolean {
    // maintenance
    const now = Date.now();
    this.mInterceptedDownloads = this.mInterceptedDownloads.filter(
      (iter) => now - iter.time < DownloadObserver.INTERCEPT_TIMEOUT,
    );

    const intercept = this.mInterceptedDownloads.find(
      (iter) => iter.tag === tag,
    );
    return intercept !== undefined;
  }

  private translateError(err: any): string {
    const t = this.mApi.translate;

    const details = renderError(err);
    return (
      `${t(details.text, { replace: details.parameters })}\n\n` +
      `${t(details.message, { replace: details.parameters })}`
    );
  }

  private handleDownloadError(
    err: Error,
    id: string,
    downloadPath: string,
    allowOpenHTML: boolean,
    callback?: (err: Error, id: string) => void,
  ): PromiseBB<void> {
    const innerState: IState = this.mApi.getState();

    const nexusIds = nexusIdsFromDownloadId(innerState, id);

    // Only track analytics if we have valid Nexus metadata
    if (nexusIds) {
      const { modUID, fileUID } = makeModAndFileUIDs(
        nexusIds.numericGameId.toString(),
        nexusIds.modId,
        nexusIds.fileId,
      );
      const isCollection =
        nexusIds.collectionSlug !== undefined &&
        nexusIds.revisionId !== undefined;

      if (err instanceof ProcessCanceled || err instanceof UserCanceled) {
        if (isCollection) {
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new CollectionsDownloadCancelledEvent(
              nexusIds.collectionId,
              nexusIds.revisionId,
              nexusIds.numericGameId,
            ),
          );
        } else {
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new ModsDownloadCancelledEvent(
              nexusIds.modId,
              nexusIds.fileId,
              nexusIds.numericGameId,
              modUID,
              fileUID,
            ),
          );
        }
      } else {
        if (isCollection) {
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new CollectionsDownloadFailedEvent(
              nexusIds.collectionId,
              nexusIds.revisionId,
              nexusIds.numericGameId,
              "",
              err.message,
            ),
          );
        } else {
          this.mApi.events.emit(
            "analytics-track-mixpanel-event",
            new ModsDownloadFailedEvent(
              nexusIds.modId,
              nexusIds.fileId,
              nexusIds.numericGameId,
              modUID,
              fileUID,
              "",
              err.message,
            ),
          );
        }
      }
    }

    if (err instanceof DownloadIsHTML) {
      const filePath: string = getSafe(
        innerState.persistent.downloads.files,
        [id, "localPath"],
        undefined,
      );

      this.mApi.store.dispatch(removeDownload(id));
      if (allowOpenHTML) {
        this.mApi.store.dispatch(showURL(err.url));
      }
      callback?.(err, id);
      if (filePath !== undefined) {
        return fs
          .removeAsync(path.join(downloadPath, filePath))
          .catch((innerErr) => {
            this.mApi.showErrorNotification(
              "Failed to remove failed download",
              innerErr,
            );
          });
      }
    } else if (err instanceof ProcessCanceled || err instanceof UserCanceled) {
      const filePath: string = getSafe(
        innerState.persistent.downloads.files,
        [id, "localPath"],
        undefined,
      );
      const prom: PromiseBB<void> =
        filePath !== undefined
          ? fs
              .removeAsync(path.join(downloadPath, filePath))
              .catch((cleanupErr) => {
                // this is a cleanup step. If the file doesn' exist that's fine with me
                if (
                  cleanupErr instanceof UserCanceled ||
                  cleanupErr["code"] === "ENOENT"
                ) {
                  return PromiseBB.resolve();
                } else {
                  return PromiseBB.reject(cleanupErr);
                }
              })
          : PromiseBB.resolve();

      return prom
        .catch((innerErr) => {
          this.mApi.showErrorNotification(
            "Failed to remove failed download",
            innerErr,
          );
        })
        .then(() => {
          const isSilent = err instanceof UserCanceled;
          this.mApi.store.dispatch(
            isSilent ? removeDownloadSilent(id) : removeDownload(id),
          );
          if (callback !== undefined) {
            callback(err, id);
          } else {
            showError(
              this.mApi.store.dispatch,
              "Download failed",
              err.message,
              {
                allowReport: false,
              },
            );
          }
        });
    } else if (err instanceof AlreadyDownloaded) {
      const downloads = innerState.persistent.downloads.files;
      const dlId = Object.keys(downloads).find(
        (iter) => downloads[iter].localPath === err.fileName,
      );
      if (dlId !== undefined) {
        err.downloadId = dlId;
      }
      this.mApi.store.dispatch(removeDownload(id));
      return PromiseBB.resolve(
        this.handleUnknownDownloadError(err, id, callback),
      );
    } else {
      return PromiseBB.resolve(
        this.handleUnknownDownloadError(err, id, callback),
      );
    }

    return PromiseBB.resolve();
  }

  private extractNxmDomain(url: string): string | undefined {
    const match = url.toString().match(/^nxm:\/\/([^\/]+)/);
    return match ? match[1] : undefined;
  }

  private handleStartDownload(
    urls: string[],
    modInfo: any,
    fileName: string,
    callback?: (error: Error, id?: string) => void,
    redownload?: RedownloadMode,
    options?: IStartDownloadOptions,
  ) {
    let callbacked = false;

    const origCallback = callback;
    if (callback !== undefined) {
      callback = (error: Error, idIn: string) => {
        callbacked = true;
        origCallback(error, idIn);
      };
    }

    const id = shortid();
    if (typeof urls !== "function") {
      if (!Array.isArray(urls)) {
        // could happen if triggered by foreign extensions, can't prevent that.
        // During beta it also happened in our own code but that should be fixed
        log("warn", "invalid url list", { urls });
        urls = [];
      }
      urls = urls.filter((url) => url !== undefined);
      if (urls.length === 0) {
        if (callback !== undefined) {
          callback(
            new ProcessCanceled(
              "URL not usable, only ftp, http and https are supported.",
            ),
          );
        }
        return;
      }
    }

    const state: IState = this.mApi.store.getState();
    let gameId: string = (modInfo || {}).game || selectors.activeGameId(state);
    if (Array.isArray(gameId)) {
      gameId = gameId[0];
    }

    if (gameId === undefined) {
      if (callback !== undefined) {
        callback(
          new ProcessCanceled(
            "You need to select a game to manage before downloading this file",
          ),
        );
      }
      return;
    }
    const downloadDomain = this.extractNxmDomain(urls[0]);

    // Convert nexus domain to internal game ID for proper path resolution
    const downloadGameId = downloadDomain
      ? convertGameIdReverse(knownGames(state), downloadDomain)
      : gameId;

    const compatibleGames = getGames().filter((game) =>
      (game.details?.compatibleDownloads ?? []).includes(gameId),
    );

    const baseIds =
      downloadDomain != null ? [downloadDomain, gameId] : [gameId];
    const gameIds = Array.from(
      new Set<string>(baseIds.concat(compatibleGames.map((game) => game.id))),
    );
    const internalId = convertGameIdReverse(
      selectors.knownGames(state),
      gameIds[0],
    );
    gameIds.sort((a, b) => (a === internalId ? -1 : b === internalId ? 1 : 0));
    this.mApi.store.dispatch(
      initDownload(
        id,
        typeof urls === "function" ? [] : urls,
        modInfo,
        gameIds,
      ),
    );

    const downloadPath = selectors.downloadPathForGame(state, internalId);

    const processCB = this.genProgressCB(id);

    const downloadOptions = this.getExtraDlOptions(modInfo ?? {}, redownload);

    const urlIn = urls[0].toString().split("<")[0];

    return withContext(`Downloading "${fileName || urlIn}"`, urlIn, () =>
      ensureDownloadsDirectory(this.mApi)
        .then(() => {
          if (this.wasIntercepted(modInfo?.referenceTag)) {
            this.mInterceptedDownloads = this.mInterceptedDownloads.filter(
              (iter) => iter.tag !== modInfo?.referenceTag,
            );
            return PromiseBB.reject(new UserCanceled());
          }
          log("info", "about to enqueue", { id, tag: modInfo?.referenceTag });
          return this.mManager.enqueue(
            id,
            urls,
            fileName,
            processCB,
            downloadPath,
            downloadOptions,
          );
        })
        .catch(UserCanceled, (err) => {
          return PromiseBB.reject(err);
        })
        .catch(AlreadyDownloaded, (err) => {
          const downloads = this.mApi.getState().persistent.downloads.files;
          const dlId = Object.keys(downloads).find(
            (iter) => downloads[iter].localPath === err.fileName,
          );
          if (dlId !== undefined && downloads[dlId].state !== "failed") {
            // File already exists and download is successful - return existing download as success
            const existingDownload = downloads[dlId];
            const downloadResult: IDownloadResult = {
              filePath: path.join(
                downloadPath,
                existingDownload.localPath || err.fileName,
              ),
              headers: existingDownload.modInfo?.headers || {},
              unfinishedChunks: existingDownload.chunks || [],
              hadErrors: false,
              size: existingDownload.size || 0,
              metaInfo: existingDownload.modInfo || {},
            };
            return PromiseBB.resolve(downloadResult);
          } else if (this.wasIntercepted(modInfo?.referenceTag)) {
            this.mInterceptedDownloads = this.mInterceptedDownloads.filter(
              (iter) => iter.tag !== modInfo?.referenceTag,
            );
            return PromiseBB.reject(new UserCanceled());
          } else {
            // there is a file but with no meta data. force the download instead
            downloadOptions.redownload = "replace";
            return this.mManager.enqueue(
              id,
              urls,
              fileName,
              processCB,
              downloadPath,
              downloadOptions,
            );
          }
        })
        .then((res: IDownloadResult) => {
          log("debug", "download finished", { id, file: res.filePath });
          return this.handleDownloadFinished(
            id,
            callback,
            res,
            options?.allowInstall ?? true,
          );
        })
        .catch((err) =>
          this.handleDownloadError(
            err,
            id,
            downloadPath,
            options?.allowOpenHTML ?? true,
            callback,
          ),
        ),
    ).catch((err) => {
      log("error", "unhandled error starting download", {
        id,
        error: err.message,
      });
      if (callback !== undefined && !callbacked) {
        callback(err, id);
      } else {
        showError(this.mApi.store.dispatch, "Download failed", err.message, {
          allowReport: false,
        });
      }
    });
  }

  private handleDownloadFinished(
    id: string,
    callback: (error: Error, id: string) => void,
    res: IDownloadResult,
    allowInstall: boolean | "force",
  ) {
    const download = this.mApi.getState().persistent.downloads.files?.[id];
    if (download === undefined) {
      // The only way for the download entry to be missing at this point
      //  is if the user had canceled the download which would mean it was
      //  removed from the state and the file no longer exists.
      callback?.(new UserCanceled(), id);
      return;
    }
    const fileName = path.basename(res.filePath);
    if (truthy(fileName)) {
      log("debug", "setting final download name", { id, fileName });
      this.mApi.store.dispatch(setDownloadFilePath(id, fileName));
    } else {
      log("error", "finished download has no filename?", res);
    }
    log("debug", "unfinished chunks", {
      chunks: JSON.stringify(res.unfinishedChunks),
    });

    const onceFinished = () => {
      if (this.mOnFinishCBs[id] !== undefined) {
        return PromiseBB.all(this.mOnFinishCBs[id].map((cb) => cb())).then(
          () => null,
        );
      } else {
        return PromiseBB.resolve();
      }
    };

    if (res.hadErrors) {
      this.mApi.store.dispatch(
        finishDownload(id, "failed", {
          message: "Download completed with chunk errors",
        }),
      );
      this.mApi.events.emit("did-finish-download", id, "failed");
      callback?.(null, id);
      return onceFinished();
    } else if (res.unfinishedChunks.length > 0) {
      this.mApi.store.dispatch(pauseDownload(id, true, res.unfinishedChunks));
      callback?.(null, id);
      return onceFinished();
    } else if (res.filePath.toLowerCase().endsWith(".html")) {
      const batched = [
        downloadProgress(id, res.size, res.size, [], undefined),
        finishDownload(id, "redirect", { htmlFile: res.filePath }),
      ];
      batchDispatch(this.mApi.store.dispatch, batched);
      this.mApi.events.emit("did-finish-download", id, "redirect");
      callback?.(new Error("html result"), id);
      return onceFinished();
    } else {
      return finalizeDownload(this.mApi, id, res.filePath)
        .then(() => {
          const flattened = flatten(res.metaInfo ?? {});
          const batchedActions: Redux.Action[] = Object.keys(flattened).map(
            (key) => setDownloadModInfo(id, key, flattened[key]),
          );
          if (batchedActions.length > 0) {
            batchDispatch(this.mApi.store.dispatch, batchedActions);
          }

          const state: IState = this.mApi.getState();

          const duration_ms = Date.now() - download.fileTime;
          const nexusIds = nexusIdsFromDownloadId(state, id);
          const isCollection =
            nexusIds?.collectionSlug !== undefined &&
            nexusIds?.revisionId !== undefined;

          // this is so we know if it's a collection bundle/manifest downloading or an individual mod
          if (isCollection) {
            this.mApi.events.emit(
              "analytics-track-mixpanel-event",
              new CollectionsDownloadCompletedEvent(
                nexusIds.collectionId,
                nexusIds.revisionId,
                nexusIds.numericGameId,
                download.size,
                duration_ms,
              ),
            );
          } else if (
            nexusIds?.modId !== undefined &&
            nexusIds?.fileId !== undefined
          ) {
            const { modUID, fileUID } = makeModAndFileUIDs(
              nexusIds.numericGameId.toString(),
              nexusIds.modId,
              nexusIds.fileId,
            );
            this.mApi.events.emit(
              "analytics-track-mixpanel-event",
              new ModsDownloadCompletedEvent(
                nexusIds.modId,
                nexusIds.fileId,
                nexusIds.numericGameId,
                modUID,
                fileUID,
                download.size,
                duration_ms,
              ),
            );
          } else {
            // This is a bundled mod - bye!
          }
          if (
            (state.settings.automation?.install && allowInstall === true) ||
            allowInstall === "force" ||
            download.modInfo?.["startedAsUpdate"] === true
          ) {
            this.mApi.events.emit("start-install-download", id);
          }

          callback?.(null, id);
        })
        .catch((err) => callback?.(err, id))
        .finally(() => onceFinished());
    }
  }

  private genProgressCB(id: string): ProgressCallback {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    let pendingUpdate = false;
    let startEventEmitted = false;
    return (
      received: number,
      total: number,
      chunks: IChunk[],
      chunkable: boolean,
      urls?: string[],
      filePath?: string,
    ) => {
      // Emit download started event on first progress callback for new downloads
      // Check state first to see if this is a brand new download (received === 0 in state)
      if (!startEventEmitted) {
        const state = this.mApi.getState();
        const download = state.persistent.downloads.files[id];
        // Only emit for new downloads that haven't received any data yet
        if (download && download.received === 0 && received > 0) {
          const nexusIds = nexusIdsFromDownloadId(state, id);
          if (
            nexusIds?.numericGameId !== undefined &&
            nexusIds?.modId !== undefined &&
            nexusIds?.fileId !== undefined
          ) {
            const { modUID, fileUID } = makeModAndFileUIDs(
              nexusIds.numericGameId.toString(),
              nexusIds.modId,
              nexusIds.fileId,
            );
            this.mApi.events.emit(
              "analytics-track-mixpanel-event",
              new ModsDownloadStartedClientEvent(
                nexusIds.modId,
                nexusIds.fileId,
                nexusIds.numericGameId,
                modUID,
                fileUID,
              ),
            );
          }
        }
        // Always mark as checked after first callback to avoid repeated state lookups
        if (received > 0) {
          startEventEmitted = true;
        }
      }

      // avoid updating too frequently because it causes ui updates
      const now = Date.now();
      const newPerc = total > 0 ? Math.floor((received * 100) / total) : 0;
      const timeDiff = now - lastUpdateTick;
      // Only update if significant change or enough time has passed
      const small =
        timeDiff < 500 && newPerc === lastUpdatePerc && filePath === undefined;
      if (!small) {
        lastUpdateTick = now;
        lastUpdatePerc = newPerc;
        // Use setImmediate to defer UI updates and prevent blocking
        if (!pendingUpdate) {
          pendingUpdate = true;
          setImmediate(() => {
            pendingUpdate = false;
            progressUpdate(
              this.mApi.store,
              id,
              received,
              total,
              chunks,
              chunkable,
              urls,
              filePath,
              false,
            );
          });
        }
      } else if (small) {
        // For small updates, still call progressUpdate but mark as small
        progressUpdate(
          this.mApi.store,
          id,
          received,
          total,
          chunks,
          chunkable,
          urls,
          filePath,
          small,
        );
      }
    };
  }

  private handleRemoveDownload(
    downloadId: string,
    cb?: (err: Error) => void,
    options?: IDownloadRemoveOptions,
  ) {
    if (downloadId === null) {
      log("warn", "invalid download id");
      return;
    }
    const download =
      this.mApi.getState().persistent.downloads.files?.[downloadId];
    if (download === undefined) {
      log("warn", "failed to remove download: unknown", { downloadId });
      return;
    }

    const proceedWithRemoval = () => {
      const callCB = (err: Error) => {
        if (cb !== undefined) {
          cb(err);
        }
      };

      const onceStopped = (): PromiseBB<void> => {
        if (truthy(download.localPath) && truthy(download.game)) {
          // this is a workaround required as of 1.3.5. Previous versions (1.3.4 and 1.3.5)
          // would put manually added downloads into the download root if no game was being managed.
          // Newer versions won't do this anymore (hopefully) but we still need to enable users to
          // clean up these broken downloads
          const rawGameId = getDownloadGames(download)[0];
          const gameId = rawGameId
            ? convertGameIdReverse(
                selectors.knownGames(this.mApi.store.getState()),
                rawGameId,
              )
            : undefined;
          const dlPath = truthy(gameId)
            ? selectors.downloadPathForGame(this.mApi.store.getState(), gameId)
            : selectors.downloadPath(this.mApi.store.getState());

          return fs
            .removeAsync(path.join(dlPath, download.localPath))
            .then(() => {
              this.mApi.store.dispatch(
                options?.silent
                  ? removeDownloadSilent(downloadId)
                  : removeDownload(downloadId),
              );
              callCB(null);
            })
            .catch(UserCanceled, callCB)
            .catch((err) => {
              if (cb !== undefined) {
                cb(err);
              } else {
                showError(
                  this.mApi.store.dispatch,
                  "Failed to remove file",
                  err,
                  {
                    allowReport: ["EBUSY", "EPERM"].indexOf(err.code) === -1,
                  },
                );
              }
            });
        } else {
          this.mApi.store.dispatch(
            options?.silent
              ? removeDownloadSilent(downloadId)
              : removeDownload(downloadId),
          );
          return PromiseBB.resolve();
        }
      };

      if (["init", "started", "paused", "failed"].includes(download.state)) {
        // need to cancel the download
        if (!this.mManager.stop(downloadId)) {
          // error case, for some reason the manager didn't know about this download, maybe some
          // delay?
          this.mInterceptedDownloads.push({
            time: Date.now(),
            tag: download.modInfo?.referenceTag,
          });
          onceStopped();
        } else {
          this.queueFinishCB(downloadId, () => onceStopped());
        }
      } else {
        onceStopped();
      }
    };

    if (options?.confirmed) {
      proceedWithRemoval();
    } else {
      const fileName = download.localPath
        ? path.basename(download.localPath)
        : downloadId;
      this.mApi
        .showDialog(
          "question",
          "Confirm Deletion",
          {
            text: "Do you really want to delete this archive?",
            message: fileName,
          },
          [{ label: "Cancel" }, { label: "Delete" }],
        )
        .then((result: IDialogResult) => {
          if (result.action === "Delete") {
            proceedWithRemoval();
          } else {
            if (cb !== undefined) {
              cb(new UserCanceled());
            }
          }
        });
    }
  }

  private handlePauseDownload(
    downloadId: string,
    callback?: (error: Error) => void,
  ) {
    const state: IState = this.mApi.store.getState();
    const download = state.persistent.downloads.files[downloadId];
    if (download === undefined) {
      log("warn", "failed to pause download: unknown", { downloadId });
      if (callback !== undefined) {
        callback(new ProcessCanceled("invalid download id"));
      }
      return;
    }

    if (["init", "started"].includes(download.state)) {
      log("debug", "pausing download", {
        id: downloadId,
        oldState: download.state,
      });
      const unfinishedChunks = this.mManager.pause(downloadId);
      if (unfinishedChunks === undefined) {
        this.mInterceptedDownloads.push({
          time: Date.now(),
          tag: download.modInfo?.referenceTag,
        });
      }
      this.mApi.store.dispatch(
        pauseDownload(downloadId, true, unfinishedChunks),
      );
      callback?.(null);
    }
  }

  private handleResumeDownload(
    downloadId: string,
    callback?: (error: Error, id: string) => void,
    options?: IStartDownloadOptions,
  ) {
    try {
      const download: IDownload =
        this.mApi.store.getState().persistent.downloads.files[downloadId];
      if (download === undefined) {
        log("warn", "failed to resume download: unknown", { downloadId });
        return;
      }

      if (download.localPath === undefined) {
        this.mApi.sendNotification({
          type: "warning",
          message: "This download can't be resumed",
        });
        return;
      }

      const knownGames = selectors.knownGames(this.mApi.store.getState());

      if (["paused", "failed"].includes(download.state)) {
        const gameMode = getDownloadGames(download)[0];
        const convertedId = convertGameIdReverse(knownGames, gameMode);
        const downloadPath = selectors.downloadPathForGame(
          this.mApi.store.getState(),
          convertedId,
        );

        const fullPath = path.join(downloadPath, download.localPath);
        this.mApi.store.dispatch(pauseDownload(downloadId, false, undefined));

        const extraInfo = this.getExtraDlOptions(
          download.modInfo ?? {},
          "always",
        );

        withContext(
          `Resuming "${download.localPath}"`,
          download.urls[0],
          () => {
            if (download.state === "failed") {
              return ensureDownloadsDirectory(this.mApi)
                .then(() =>
                  this.mManager.enqueue(
                    downloadId,
                    download.urls,
                    path.basename(fullPath),
                    this.genProgressCB(downloadId),
                    undefined,
                    { redownload: "replace" },
                  ),
                )
                .then((res) => {
                  log("debug", "download finished (re-tried)", {
                    file: res.filePath,
                  });
                  return this.handleDownloadFinished(
                    downloadId,
                    callback,
                    res,
                    options?.allowInstall ?? true,
                  );
                })
                .catch((err) =>
                  this.handleDownloadError(
                    err,
                    downloadId,
                    downloadPath,
                    options?.allowOpenHTML ?? true,
                    callback,
                  ),
                );
            } else {
              return ensureDownloadsDirectory(this.mApi)
                .then(() =>
                  this.mManager.resume(
                    downloadId,
                    fullPath,
                    download.urls,
                    download.received,
                    download.size,
                    download.startTime,
                    download.chunks,
                    this.genProgressCB(downloadId),
                    extraInfo,
                  ),
                )
                .then((res) => {
                  log("debug", "download finished (resumed)", {
                    file: res.filePath,
                  });
                  return this.handleDownloadFinished(
                    downloadId,
                    callback,
                    res,
                    options?.allowInstall ?? true,
                  );
                })
                .catch((err) =>
                  this.handleDownloadError(
                    err,
                    downloadId,
                    downloadPath,
                    options?.allowOpenHTML ?? true,
                    callback,
                  ),
                );
            }
          },
        ).catch((err) => {
          log("error", "unhandled error resuming download", {
            downloadId,
            error: err.message,
          });
          if (callback !== undefined) {
            callback(err, downloadId);
          } else {
            showError(
              this.mApi.store.dispatch,
              "Download failed",
              err.message,
              { allowReport: false },
            );
          }
        });
      }
    } catch (err) {
      if (callback !== undefined) {
        callback(unknownToError(err), downloadId);
      }
    }
  }

  private async attemptResumeDownload(
    downloadId: string,
    callback?: (err: Error, id?: string) => void,
  ) {
    await new PromiseBB((resolve) => setTimeout(resolve, 1000));
    const download =
      this.mApi.store.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log("warn", "attempted to resume unknown download", { downloadId });
      if (callback !== undefined) {
        callback(new ProcessCanceled("invalid download id"));
      }
      return;
    }
    if (["paused"].includes(download.state)) {
      log("debug", "attempting to resume download", {
        id: downloadId,
        state: download.state,
      });
      this.handleResumeDownload(downloadId, callback);
      return;
    }
    log("debug", "not resuming download", {
      id: downloadId,
      state: download.state,
    });
    if (callback !== undefined) {
      callback(new ProcessCanceled("download not paused"));
    }
    return PromiseBB.resolve();
  }

  private incrementResumeAttempts(downloadId: string) {
    this.mResumeAttempts[downloadId] =
      (this.mResumeAttempts[downloadId] || 0) + 1;
    log(
      "info",
      `Resume attempt #${this.mResumeAttempts[downloadId]} for download`,
      { downloadId },
    );
  }

  private handleUnknownDownloadError(
    err: any,
    downloadId: string,
    callback?: (err: Error, id?: string) => void,
  ) {
    if (["ESOCKETTIMEDOUT", "ECONNRESET", "EBADF", "EIO"].includes(err.code)) {
      // may be resumable
      this.handlePauseDownload(downloadId);
      // Track the number of resume attempts for this download
      this.incrementResumeAttempts(downloadId);
      if (
        this.mResumeAttempts[downloadId] > DownloadObserver.MAX_RESUME_ATTEMPTS
      ) {
        if (callback !== undefined) {
          callback(new TemporaryError("I/O Error"), downloadId);
        } else {
          showError(
            this.mApi.store.dispatch,
            "Download failed",
            "The download failed due to an I/O error (network or writing to disk). " +
              "This is likely a temporary issue, please try resuming later.",
            {
              allowReport: false,
            },
          );
        }
      } else {
        return this.attemptResumeDownload(downloadId, callback);
      }
    } else if (
      err.code === "ERR_SSL_WRONG_VERSION_NUMBER" ||
      err.code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
    ) {
      // may be resumable
      this.handlePauseDownload(downloadId);
      if (callback !== undefined) {
        callback(new TemporaryError("SSL Error"), downloadId);
      } else {
        showError(
          this.mApi.store.dispatch,
          "Download failed",
          "The download failed due to a https certificate error. " +
            "This is is usually caused by misconfigured or outdated " +
            "AntiVirus, Firewall, VPN or proxy. " +
            "You can try resuming the download to see if it was a temporary issue but also " +
            "please check your network-related software for updates.",
          {
            allowReport: false,
          },
        );
      }
    } else if (err instanceof TemporaryError) {
      this.handlePauseDownload(downloadId);
      this.incrementResumeAttempts(downloadId);
      if (
        this.mResumeAttempts[downloadId] > DownloadObserver.MAX_RESUME_ATTEMPTS
      ) {
        if (callback !== undefined) {
          callback(err, downloadId);
        } else {
          showError(this.mApi.store.dispatch, "Download failed", err.message, {
            allowReport: false,
          });
        }
      } else {
        return this.attemptResumeDownload(downloadId, callback);
      }
    } else {
      const message = this.translateError(err);

      log("info", "download failed", { downloadId, message });

      this.mApi.store.dispatch(
        finishDownload(downloadId, "failed", {
          message,
        }),
      );
      this.mApi.events.emit("did-finish-download", downloadId, "failed");
      if (callback !== undefined) {
        callback(err, downloadId);
      } else {
        // only report error if there was no callback, otherwise it's the caller's job to report
        showError(this.mApi.store.dispatch, "Download failed", message, {
          allowReport: false,
        });
      }
    }
    return PromiseBB.resolve();
  }

  private getExtraDlOptions(
    modInfo: any,
    redownload: RedownloadMode,
  ): IDownloadOptions {
    return {
      referer: modInfo.referer,
      redownload,
      nameHint: modInfo.name,
      tag: modInfo.referenceTag,
    };
  }
}

/**
 * hook up the download manager to handle internal events
 *
 */
function observe(api: IExtensionApi, manager: DownloadManager) {
  return new DownloadObserver(api, manager);
}

export default observe;
