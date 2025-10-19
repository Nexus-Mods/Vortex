import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import {ProcessCanceled, TemporaryError, UserCanceled} from '../../util/CustomErrors';
import { withContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {renderError, showError} from '../../util/message';
import { downloadPathForGame, queueClearingDownloads } from './selectors';
import { downloadPath } from './selectors';
import { activeGameId } from '../profile_management/activeGameId';
import { getSafe } from '../../util/storeHelper';
import { flatten, setdefault, truthy } from '../../util/util';

import { showURL } from '../browser/actions';
import { convertGameIdReverse } from '../nexus_integration/util/convertGameId';
import { knownGames } from '../gamemode_management/selectors';
import { interceptDownloadURLForMacOS } from '../../util/macOSGameCompatibility';

import {
  downloadProgress,
  finishDownload,
  initDownload,
  pauseDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadModInfo,
  setDownloadPausable,
} from './actions/state';
import {IChunk} from './types/IChunk';
import {IDownload, IDownloadOptions} from './types/IDownload';
import { IDownloadResult } from './types/IDownloadResult';
import { ProgressCallback } from './types/ProgressCallback';
import { ensureDownloadsDirectory } from './util/downloadDirectory';
import getDownloadGames from './util/getDownloadGames';
import { finalizeDownload } from './util/postprocessDownload';

import DownloadManager, { AlreadyDownloaded, DownloadIsHTML, RedownloadMode } from './DownloadManager';

// TODO: Remove Bluebird import - using native Promise;
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';
import { getGames } from '../gamemode_management/util/getGame';
import { util } from '../..';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, chunks: IChunk[], chunkable: boolean,
                        urls: string[], filePath: string, smallUpdate: boolean) {
  const state = store.getState();
  const download: IDownload = state.persistent.downloads.files[dlId];
  if (download === undefined) {
    // progress for a download that's no longer active
    return;
  }
  const updates: any[] = [];
  if (((total !== 0) && !smallUpdate) || (chunks !== undefined)) {
    if (received < 0)  {
      log('warn', 'invalid download progress', { received, total });
    }
    updates.push(downloadProgress(dlId, received, total, chunks, urls));
  }
  if ((filePath !== undefined) && (path.basename(filePath) !== download.localPath)) {
    updates.push(setDownloadFilePath(dlId, path.basename(filePath)));
  }
  if ((chunkable !== undefined) && (chunkable !== download.pausable)) {
    updates.push(setDownloadPausable(dlId, chunkable));
  }
  if (updates.length > 0) {
    util.batchDispatch(store.dispatch, updates);
  }
}

export interface IStartDownloadOptions {
  // whether the download may be auto-installed if the user has that set up for mods (default: true)
  // if set to 'force', the download will be installed independent of the user config
  allowInstall?: boolean | 'force';
  // whether the url should be opened in the embedded browser if it's html (default: true)
  allowOpenHTML?: boolean;
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
  private mOnFinishCBs: { [dlId: string]: Array<() => Promise<void>> } = {};
  private mInterceptedDownloads: Array<{ time: number, tag: string }> = [];
  private mResumeAttempts: { [downloadId: string]: number } = {};

  constructor(api: IExtensionApi, manager: DownloadManager) {
    this.mApi = api;
    const events = api.events;
    this.mManager = manager;

    events.on('remove-download',
              (downloadId, callback?) => this.handleRemoveDownload(downloadId, callback));
    events.on('pause-download',
              (downloadId, callback?) => this.handlePauseDownload(downloadId, callback));
    events.on('resume-download',
              (downloadId, callback?, options?) =>
                this.handleResumeDownload(downloadId, callback, options));
    events.on('start-download',
              (urls, modInfo, fileName?, callback?, redownload?, options?) =>
                this.handleStartDownload(urls, modInfo, fileName, callback,
                                         redownload, options));
    // this is a bit of a hack that lets callers intercept a queued download that was not started
    // yet (e.g. it may be waiting to ensure the download dir exists)
    // for this to work the modInfo of the download has to contain a referenceTag corresponding to
    // the tag passed here
    events.on('intercept-download', (tag) => {
      this.mInterceptedDownloads.push({ time: Date.now(), tag });
    });

    api.onStateChange(['persistent', 'nexus', 'userInfo'], (old, newValue) => {
      if (old?.isPremium !== newValue?.isPremium) {
        // User's premium status has changed; avoid losing progress.
        // Pause ongoing downloads, adjust concurrency, and attempt resume.
        const state = api.getState();
        const activeDownloadsList = queueClearingDownloads(state);
        Object.keys(activeDownloadsList).forEach(dlId => {
          try {
            log('info', 'pausing download due to membership change', { id: dlId, premium: newValue?.isPremium });
          } catch (_) { /* noop */ }
          this.handlePauseDownload(dlId);
          // Schedule a resume attempt shortly after user info refresh settles
          setTimeout(() => this.attemptResumeDownload(dlId), 1500);
        });
        if (newValue?.isPremium === true) {
          manager.setMaxConcurrentDownloads(10);
        } else {
          manager.setMaxConcurrentDownloads(1);
        }
      }
    });
  }

  // enqueues an operation to be run when a download finishes
  private queueFinishCB(id: string, cb: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      setdefault(this.mOnFinishCBs, id, []).push(() => cb().then(resolve));
    });
  }

  private wasIntercepted(tag: string): boolean {
    // maintenance
    const now = Date.now();
    this.mInterceptedDownloads = this.mInterceptedDownloads
      .filter(iter => (now - iter.time) < DownloadObserver.INTERCEPT_TIMEOUT);

    const intercept = this.mInterceptedDownloads.find(iter => iter.tag === tag);
    return (intercept !== undefined);
  }

  private translateError(err: any): string {
    const t = this.mApi.translate;

    const details = renderError(err);
    return `${t(details.text, {replace: details.parameters})}\n\n`
         + `${t(details.message, { replace: details.parameters })}`;
  }

  private handleDownloadError(err: Error, id: string, downloadPath: string,
                              allowOpenHTML: boolean,
                              callback?: (err: Error, id: string) => void): Promise<void> {
    const innerState: IState = this.mApi.getState();
    if (err instanceof DownloadIsHTML) {
      const filePath: string =
        getSafe(innerState.persistent.downloads.files, [id, 'localPath'], undefined);

      this.mApi.store.dispatch(removeDownload(id));
      if (allowOpenHTML) {
        this.mApi.store.dispatch(showURL(err.url));
      }
      callback?.(err, id);
      if (filePath !== undefined) {
        return fs.removeAsync(path.join(downloadPath, filePath))
          .catch(innerErr => {
            this.mApi.showErrorNotification('Failed to remove failed download', innerErr);
          });
      }
    } else if ((err instanceof ProcessCanceled) || (err instanceof UserCanceled)) {
      const filePath: string =
        getSafe(innerState.persistent.downloads.files, [id, 'localPath'], undefined);
      const prom: Promise<void> = (filePath !== undefined)
        ? fs.removeAsync(path.join(downloadPath, filePath))
          .catch(cleanupErr => {
            // this is a cleanup step. If the file' doesn't exist that's fine with me
            if ((cleanupErr instanceof UserCanceled) || (cleanupErr['code'] === 'ENOENT')) {
              return Promise.resolve();
            } else {
              return Promise.reject(cleanupErr);
            }
          })
        : Promise.resolve();

      return prom
        .catch(innerErr => {
          this.mApi.showErrorNotification('Failed to remove failed download', innerErr);
        })
        .then(() => {
          this.mApi.store.dispatch(removeDownload(id));
          if (callback !== undefined) {
            callback(err, id);
          } else {
            showError(this.mApi.store.dispatch, 'Download failed', err.message, {
              allowReport: false,
            });
          }
        });
    } else if (err instanceof AlreadyDownloaded) {
      const downloads = innerState.persistent.downloads.files;
      const dlId = Object.keys(downloads)
        .find(iter => downloads[iter].localPath === err.fileName);
      if (dlId !== undefined) {
        err.downloadId = dlId;
      }
      // Remove the transient download entry; the file already exists.
      this.mApi.store.dispatch(removeDownload(id));
      // Do NOT treat as an unknown error. Either notify the caller via callback,
      // or quietly resolve to avoid showing a generic error dialog.
      if (callback !== undefined) {
        callback(err, err['downloadId'] ?? dlId ?? id);
      } else {
        // Best-effort: if we know the existing download, emit a finish event to
        // let the UI update without showing an error dialog. Otherwise, just resolve.
        if ((dlId !== undefined) && (downloads[dlId]?.state !== 'failed')) {
          this.mApi.events.emit('did-finish-download', dlId, downloads[dlId].state);
        }
      }
      return Promise.resolve();
    } else {
      return Promise.resolve(this.handleUnknownDownloadError(err, id, callback));
    }

    return Promise.resolve();
  }

  private extractNxmDomain(url: string): string | undefined {
    const match = url.match(/^nxm:\/\/([^\/]+)/);
    return match ? match[1] : undefined;
  }

  private handleStartDownload(urls: string[],
                              modInfo: any,
                              fileName: string,
                              callback?: (error: Error, id?: string) => void,
                              redownload?: RedownloadMode,
                              options?: IStartDownloadOptions) {
    let callbacked = false;

    const origCallback = callback;
    if (callback !== undefined) {
      callback = (error: Error, idIn: string) => {
        callbacked = true;
        origCallback(error, idIn);
      };
    }

    const id = shortid();

    // Verbose: initial request context
    try {
      log('info', 'download request received', {
        id,
        fileName,
        urlCount: Array.isArray(urls) ? urls.length : undefined,
        redownload,
        allowInstall: options?.allowInstall,
        allowOpenHTML: options?.allowOpenHTML,
        modInfoKeys: Object.keys(modInfo || {}),
      });
    } catch (_) { /* noop */ }
    if (typeof(urls) !== 'function') {
      if (!Array.isArray(urls)) {
        // could happen if triggered by foreign extensions, can't prevent that.
        // During beta it also happened in our own code but that should be fixed
        log('warn', 'Invalid URL list', { urls });
        urls = [];
      }
      urls = urls.filter(url => url !== undefined);
      
      // Intercept URLs for macOS compatibility (e.g., Lovely injector)
      urls = urls.map(url => interceptDownloadURLForMacOS(url));
      
      if (urls.length === 0) {
        if (callback !== undefined) {
          callback(new ProcessCanceled('URL not usable, only ftp, http and https are supported.'));
        }
        return;
      }
    }

    const state: IState = this.mApi.store.getState();
    let gameId: string = (modInfo || {}).game || activeGameId(state);
    
    // Debug logging for macOS compatibility
    log('debug', 'DownloadObserver: Processing URLs for macOS compatibility', {
      originalUrls: urls,
      gameId: gameId
    });
    if (Array.isArray(gameId)) {
      gameId = gameId[0];
    }

    if (gameId === undefined) {
      if (callback !== undefined) {
        callback(new ProcessCanceled(
          'You need to select a game to manage before downloading this file'));
      }
      return;
    }
    const downloadDomain = this.extractNxmDomain(urls[0]);

    // Convert nexus domain to internal game ID for proper path resolution
    const downloadGameId = downloadDomain
      ? convertGameIdReverse(knownGames(state), downloadDomain)
      : gameId;

    const compatibleGames = getGames().filter(game =>
      (game.details?.compatibleDownloads ?? []).includes(gameId));

    const baseIds = downloadDomain != null
      ? [downloadDomain, gameId]
      : [gameId];
    const gameIds = Array.from(new Set<string>(baseIds.concat(compatibleGames.map(game => game.id))));

    // Use the converted internal game ID for download path instead of the domain name
    // This ensures downloads are saved to the correct directory based on Vortex's
    // internal game identification rather than the Nexus domain name
    let downloadPath = downloadPathForGame(state, downloadGameId);

    // Verbose: resolved download context
    try {
      log('debug', 'resolved download context', {
        id,
        gameId,
        downloadDomain,
        downloadGameId,
        gameIds,
        downloadPath,
      });
    } catch (_) { /* noop */ }

    const processCB = this.genProgressCB(id);

    const downloadOptions = this.getExtraDlOptions(modInfo ?? {}, redownload);

    const urlIn = urls[0].split('<')[0];

    return withContext(`Downloading "${fileName || urlIn}"`, urlIn, () =>
      ensureDownloadsDirectory(this.mApi)
        .then(() => {
          // Create the download entry only after the downloads directory has been ensured.
          // This prevents the first-download flow from thinking there are existing downloads
          // and showing the "Downloads Folder missing!" dialog instead of auto-creating.
          this.mApi.store.dispatch(
            initDownload(id, typeof(urls) ===  'function' ? [] : urls, modInfo, gameIds));

          // Recompute download path after ensure as it may have been reset.
          downloadPath = downloadPathForGame(this.mApi.store.getState(), downloadGameId);

          if (this.wasIntercepted(modInfo?.referenceTag)) {
            this.mInterceptedDownloads = this.mInterceptedDownloads
              .filter(iter => iter.tag !== modInfo?.referenceTag);
            return Promise.reject(new UserCanceled());
          }

          log('info', 'about to enqueue', {
            id,
            tag: modInfo?.referenceTag,
            fileName,
            downloadPath,
            urlCount: Array.isArray(urls) ? urls.length : undefined,
          });
          return this.mManager.enqueue(id, urls, fileName, processCB,
                                       downloadPath, downloadOptions);
        })
        .catch(err => err instanceof AlreadyDownloaded ? (
          (() => {
            const downloads = this.mApi.getState().persistent.downloads.files;
            const dlId = Object.keys(downloads)
              .find(iter => downloads[iter].localPath === err.fileName);
            if ((dlId !== undefined) && (downloads[dlId].state !== 'failed')) {
              err.downloadId = dlId;
              return Promise.reject(err);
            } else if (this.wasIntercepted(modInfo?.referenceTag)) {
              this.mInterceptedDownloads = this.mInterceptedDownloads
                .filter(iter => iter.tag !== modInfo?.referenceTag);
              return Promise.reject(new UserCanceled());
            } else {
              // there is a file but with no meta data. force the download instead
              downloadOptions.redownload = 'replace';
              return this.mManager.enqueue(id, urls, fileName, processCB,
                                           downloadPath, downloadOptions);
            }
          })()
        ) : Promise.reject(err))
        .then((res: IDownloadResult) => {
          try {
            log('debug', 'download finished', {
              id,
              file: res.filePath,
              size: res.size,
              unfinishedChunks: res.unfinishedChunks?.length,
            });
          } catch (_) { /* noop */ }
          return this.handleDownloadFinished(id, res, callback);
        })
        .catch(err => this.handleDownloadError(err, id, downloadPath,
                                               options?.allowOpenHTML ?? true, callback));
  }

  private handleDownloadFinished = (id: string, res: any, callback?: (err: Error, id?: string) => void) => {
    const download: IDownload = this.mApi.store.getState().persistent.downloads.files[id];
    if (download === undefined) {
      log('warn', 'download finished for unknown download', { id });
      if (callback !== undefined) {
        callback(new ProcessCanceled('invalid download id'));
      }
      return;
    }

    log('info', 'handleDownloadFinished entered', { id, filePath: res.filePath, allowInstall: res.allowInstall });

    // Set the final download name if it's different from current
    if ((res.fileName !== undefined) && (res.fileName !== download.localPath)) {
      log('debug', 'setting final download name', { id, fileName: res.fileName });
      this.mApi.store.dispatch(setDownloadFilePath(id, res.fileName));
    }

    // Handle extension downloads specially
    const isExtensionDownload = download.game?.includes('site') || 
                               (download.modInfo?.game === 'site') ||
                               (download.localPath?.toLowerCase().includes('extension'));

    if (isExtensionDownload) {
      // For extension downloads, we want to show installation progress
      log('debug', 'handling extension download completion', { id, filePath: res.filePath });
      
      // Update download state to finalizing to show installation progress
      this.mApi.store.dispatch(finishDownload(id, 'finished', {
        message: 'Installing extension...',
        filePath: res.filePath,
      }));
      
      // Process the extension installation
      this.processExtensionDownload(id, res.filePath, callback);
      return;
    }

    // Handle regular downloads
    const unfinishedChunks = res.unfinishedChunks;
    if (unfinishedChunks === undefined) {
      this.mInterceptedDownloads.push({
        time: Date.now(),
        tag: download.modInfo?.referenceTag,
      });
    }
    
    // Safety: if there are unfinished chunks, resume immediately without a visible pause
    if (Array.isArray(res.unfinishedChunks) && res.unfinishedChunks.length > 0) {
      try { log('debug', 'unfinished chunks detected, resuming immediately without UI pause', { id, count: res.unfinishedChunks.length }); } catch (_) { /* noop */ }

      // Keep the download in a running state to avoid flicker
      // and resume directly using the manager.
      const state = this.mApi.getState();
      const currentDownload = state.persistent.downloads.files?.[id];
      if (!currentDownload) {
        // If the download entry is gone, fall back to a delayed resume attempt
        setTimeout(() => this.attemptResumeDownload(id), 500);
        callback?.(null, id);
        return;
      }

      const gameMode = getDownloadGames(currentDownload)[0];
      const downloadPath = downloadPathForGame(this.mApi.store.getState(), gameMode);
      const fullPath = res.filePath || path.join(downloadPath, currentDownload.localPath);

      // Clear any paused marker and avoid dispatching a paused state
      this.mApi.store.dispatch(pauseDownload(id, false, undefined));

      const extraInfo = this.getExtraDlOptions(currentDownload.modInfo ?? {}, 'always');
      
      // Resume the download with the unfinished chunks
      return ensureDownloadsDirectory(this.mApi)
        .then(() => this.mManager.resume(id, fullPath, currentDownload.urls,
                                        currentDownload.received, currentDownload.size, currentDownload.startTime, unfinishedChunks,
                                        this.genProgressCB(id), extraInfo))
        .then(res => {
          log('debug', 'download finished (resumed)', { file: res.filePath });
          return this.handleDownloadFinished(id, res, callback);
        })
        .catch(err => this.handleDownloadError(err, id, downloadPath,
                                              true, callback));
    } else {
      // Normal download completion
      this.mApi.store.dispatch(finishDownload(id, 'finished', {
        message: 'Download finished',
        filePath: res.filePath,
      }));
      this.mApi.events.emit('did-finish-download', id, 'finished');
      if (callback !== undefined) {
        callback(null, id);
      }
      return;
    }
  }

  private processExtensionDownload = (id: string, filePath: string, callback?: (err: Error, id?: string) => void) => {
    log('info', 'processing extension download', { id, filePath });
    
    // Emit the install-extension-from-download event to trigger extension installation
    this.mApi.events.emit('install-extension-from-download', id, (err: Error) => {
      if (err) {
        log('error', 'extension installation failed', { id, error: err.message });
        this.mApi.store.dispatch(finishDownload(id, 'failed', {
          message: `Extension installation failed: ${err.message}`,
        }));
        this.mApi.events.emit('did-finish-download', id, 'failed');
        if (callback !== undefined) {
          callback(err, id);
        }
      } else {
        log('info', 'extension installation completed successfully', { id });
        // Update download state to finished
        this.mApi.store.dispatch(finishDownload(id, 'finished', {
          message: 'Extension installed successfully',
        }));
        this.mApi.events.emit('did-finish-download', id, 'finished');
        if (callback !== undefined) {
          callback(null, id);
        }
      }
    });
  }

  private genProgressCB(id: string): ProgressCallback {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    let pendingUpdate = false;
    return (received: number, total: number, chunks: IChunk[], chunkable: boolean,
            urls?: string[], filePath?: string) => {
      // avoid updating too frequently because it causes ui updates
      const now = Date.now();
      const newPerc = total > 0 ? Math.floor((received * 100) / total) : 0;
      const timeDiff = now - lastUpdateTick;
      // Only update if significant change or enough time has passed
      const small = (timeDiff < 500) && (newPerc === lastUpdatePerc) && (filePath === undefined);
      if (!small) {
        lastUpdateTick = now;
        lastUpdatePerc = newPerc;
        // Use setImmediate to defer UI updates and prevent blocking
        if (!pendingUpdate) {
          pendingUpdate = true;
          setImmediate(() => {
            pendingUpdate = false;
            progressUpdate(this.mApi.store, id, received, total, chunks, chunkable,
                           urls, filePath, false);
          });
        }
      } else if (small) {
        // For small updates, still call progressUpdate but mark as small
        progressUpdate(this.mApi.store, id, received, total, chunks, chunkable,
                       urls, filePath, small);
      }
    };
  }

  private handleRemoveDownload(downloadId: string, cb?: (err: Error) => void) {
    if (downloadId === null) {
      log('warn', 'invalid download id');
      return;
    }
    const download = this.mApi.getState().persistent.downloads.files?.[downloadId];
    if (download === undefined) {
      log('warn', 'failed to remove download: unknown', {downloadId});
      return;
    }

    const callCB = (err: Error) => {
      if (cb !== undefined) {
        cb(err);
      }
    };

    const onceStopped = (): Promise<void> => {
      if (truthy(download.localPath) && truthy(download.game)) {
        // this is a workaround required as of 1.3.5. Previous versions (1.3.4 and 1.3.5)
        // would put manually added downloads into the download root if no game was being managed.
        // Newer versions won't do this anymore (hopefully) but we still need to enable users to
        // clean up these broken downloads
        const rawGameId = getDownloadGames(download)[0];
        const gameId = rawGameId ? convertGameIdReverse(knownGames(this.mApi.store.getState()), rawGameId) : undefined;
        const dlPath = truthy(gameId)
          ? downloadPathForGame(this.mApi.store.getState(), gameId)
          : downloadPath(this.mApi.store.getState());

        return fs.removeAsync(path.join(dlPath, download.localPath))
          .then(() => {
            this.mApi.store.dispatch(removeDownload(downloadId));
            callCB(null);
          })
          .catch(err => { if (err instanceof UserCanceled) { return callCB(); } else { return Promise.reject(err); }})
          .finally(() => {
            this.mApi.store.dispatch(setDownloadPaused(downloadId, false));
          })
          .catch(err => {
            if (cb !== undefined) {
              cb(err);
            } else {
              showError(this.mApi.store.dispatch, 'Failed to remove file', err, {
                allowReport: ['EBUSY', 'EPERM'].indexOf(err.code) === -1,
              });
            }
          });
      } else {
        this.mApi.store.dispatch(removeDownload(downloadId));
        callCB(null);
        return Promise.resolve();
      }
    } else {
      this.mApi.store.dispatch(removeDownload(downloadId));
      return Promise.resolve();
    }
  }

  private handlePauseDownload(downloadId: string, callback?: (error: Error) => void) {
    const state: IState = this.mApi.store.getState();
    const download = state.persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to pause download: unknown', {downloadId});
      if (callback !== undefined) {
        callback(new ProcessCanceled('invalid download id'));
      }
      return;
    }

    if (['init', 'started'].includes(download.state)) {
      log('debug', 'pausing download', { id: downloadId, oldState: download.state });
      const unfinishedChunks = this.mManager.pause(downloadId);
      if (unfinishedChunks === undefined) {
        this.mInterceptedDownloads.push({
          time: Date.now(),
          tag: download.modInfo?.referenceTag,
        });
      }
      this.mApi.store.dispatch(pauseDownload(downloadId, true, unfinishedChunks));
      callback?.(null);
    }
  }

  private handleResumeDownload(downloadId: string,
                               callback?: (error: Error, id: string) => void,
                               options?: IStartDownloadOptions) {
    try {
      const download: IDownload =
        this.mApi.store.getState().persistent.downloads.files[downloadId];
      if (download === undefined) {
        log('warn', 'failed to resume download: unknown', { downloadId });
        return;
      }

      if (download.localPath === undefined) {
        this.mApi.sendNotification({
          type: 'warning',
          message: 'This download can\'t be resumed',
        });
        return;
      }

      if (['paused', 'failed'].includes(download.state)) {
        const gameMode = getDownloadGames(download)[0];
        const downloadPath = downloadPathForGame(this.mApi.store.getState(), gameMode);

        const fullPath = path.join(downloadPath, download.localPath);
        this.mApi.store.dispatch(pauseDownload(downloadId, false, undefined));

        const extraInfo = this.getExtraDlOptions(download.modInfo ?? {}, 'always');

        withContext(`Resuming "${download.localPath}"`, download.urls[0], () => {
          if (download.state === 'failed') {
            return ensureDownloadsDirectory(this.mApi)
              .then(() => this.mManager.enqueue(downloadId, download.urls,
                                                path.basename(fullPath), this.genProgressCB(downloadId),
                                                undefined, { redownload: 'replace' }))
              .then(res => {
                log('debug', 'download finished (re-tried)', { file: res.filePath });
                return this.handleDownloadFinished(downloadId, res, callback);
              })
              .catch(err => this.handleDownloadError(err, downloadId, downloadPath,
                                                     options?.allowOpenHTML ?? true, callback));
          } else {
            return ensureDownloadsDirectory(this.mApi)
              .then(() => this.mManager.resume(downloadId, fullPath, download.urls,
                                               download.received, download.size, download.startTime, download.chunks,
                                               this.genProgressCB(downloadId), extraInfo))
              .then(res => {
                log('debug', 'download finished (resumed)', { file: res.filePath });
                return this.handleDownloadFinished(downloadId, res, callback);
              })
              .catch(err => this.handleDownloadError(err, downloadId, downloadPath,
                                                     options?.allowOpenHTML ?? true, callback));
          }
        });
      }
    } catch (err) {
      if (callback !== undefined) {
        callback(err, downloadId);
      }
    }
  }

  private async attemptResumeDownload(downloadId: string, callback?: (err: Error, id?: string) => void) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const download = this.mApi.store.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'attempted to resume unknown download', { downloadId });
      if (callback !== undefined) {
        callback(new ProcessCanceled('invalid download id'));
      }
      return;
    }
    if (['paused'].includes(download.state)) {
      if (download.chunks > 0) {
        log('debug', 'attempting to resume download', { id: downloadId, state: download.state });
        return this.handleResumeDownload(downloadId, callback);
      } else {
        return this.handleStartDownload(download.urls, download.modInfo,
                                        download.localPath, callback, 'never');
      }
    }
    log('debug', 'not resuming download', { id: downloadId, state: download.state });
    if (callback !== undefined) {
      callback(new ProcessCanceled('download not paused'));
    }
    return Promise.resolve();
  }

  private incrementResumeAttempts(downloadId: string) {
    this.mResumeAttempts[downloadId] = (this.mResumeAttempts[downloadId] || 0) + 1;
    log('info', `Resume attempt #${this.mResumeAttempts[downloadId]} for download`, { downloadId });
  }

  private handleUnknownDownloadError(err: any,
                                     downloadId: string,
                                     callback?: (err: Error, id?: string) => void) {
    if (['ESOCKETTIMEDOUT', 'ECONNRESET', 'EBADF', 'EIO'].includes(err.code)) {
      // may be resumable
      this.handlePauseDownload(downloadId);
      // Track the number of resume attempts for this download
      this.incrementResumeAttempts(downloadId);
      if (this.mResumeAttempts[downloadId] > DownloadObserver.MAX_RESUME_ATTEMPTS) {
        if (callback !== undefined) {
          callback(new TemporaryError('I/O Error'), downloadId);
        } else {
          showError(this.mApi.store.dispatch, 'Download failed',
                    'The download failed due to an I/O error (network or writing to disk). '
            + 'This is likely a temporary issue, please try resuming later.', {
                      allowReport: false,
                    });
        }  
      } else {
        return this.attemptResumeDownload(downloadId, callback);
      }
    } else if ((err.code === 'ERR_SSL_WRONG_VERSION_NUMBER')
               || (err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY')) {
      // may be resumable
      this.handlePauseDownload(downloadId);
      if (callback !== undefined) {
        callback(new TemporaryError('SSL Error'), downloadId);
      } else {
        showError(this.mApi.store.dispatch, 'Download failed',
                  'The download failed due to a https certificate error. '
          + 'This is is usually caused by misconfigured or outdated '
          + 'AntiVirus, Firewall, VPN or proxy. '
          + 'You can try resuming the download to see if it was a temporary issue but also '
          + 'please check your network-related software for updates.', {
                    allowReport: false,
                  });
      }
    } else if (err instanceof TemporaryError) {
      this.handlePauseDownload(downloadId);
      this.incrementResumeAttempts(downloadId);
      if (this.mResumeAttempts[downloadId] > DownloadObserver.MAX_RESUME_ATTEMPTS) {
        if (callback !== undefined) {
          callback(err, downloadId);
        } else {
          showError(this.mApi.store.dispatch, 'Download failed',
                    err.message, {
                      allowReport: false,
                    });
        }  
      } else {
        return this.attemptResumeDownload(downloadId, callback);
      }
    } else {
      const message = this.translateError(err);

      log('info', 'download failed', { downloadId, message });

      this.mApi.store.dispatch(finishDownload(downloadId, 'failed', {
        message,
      }));
      this.mApi.events.emit('did-finish-download', downloadId, 'failed');
      if (callback !== undefined) {
        callback(err, downloadId);
      } else {
        // only report error if there was no callback, otherwise it's the caller's job to report
        showError(this.mApi.store.dispatch, 'Download failed', message, {
          allowReport: false,
        });
      }
    }
    return Promise.resolve();
  }

  private getExtraDlOptions(modInfo: any, redownload: RedownloadMode): IDownloadOptions {
    return {
      referer: modInfo.referer,
      redownload,
      nameHint: modInfo.name,
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
