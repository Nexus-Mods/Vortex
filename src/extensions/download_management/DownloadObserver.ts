import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import {ProcessCanceled, TemporaryError, UserCanceled} from '../../util/CustomErrors';
import { withContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {renderError, showError} from '../../util/message';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { flatten, setdefault, truthy } from '../../util/util';

import { showURL } from '../browser/actions';

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

import Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, chunks: IChunk[], chunkable: boolean,
                        urls: string[], filePath: string, smallUpdate: boolean) {
  const download: IDownload = store.getState().persistent.downloads.files[dlId];
  if (download === undefined) {
    // progress for a download that's no longer active
    return;
  }
  if (((total !== 0) && !smallUpdate) || (chunks !== undefined)) {
    if (received < 0)  {
      log('warn', 'invalid download progress', { received, total });
    }
    store.dispatch(downloadProgress(dlId, received, total, chunks, urls));
  }
  if ((filePath !== undefined) && (path.basename(filePath) !== download.localPath)) {
    store.dispatch(setDownloadFilePath(dlId, path.basename(filePath)));
  }
  if ((chunkable !== undefined) && (chunkable !== download.pausable)) {
    store.dispatch(setDownloadPausable(dlId, chunkable));
  }
}

export interface IStartDownloadOptions {
  // whether the download may be auto-installed if the user has that set up for mods (default: true)
  allowInstall?: boolean;
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
  private mApi: IExtensionApi;
  private mManager: DownloadManager;
  private mOnFinishCBs: { [dlId: string]: Array<() => Promise<void>> } = {};
  private mInterceptedDownloads: Array<{ time: number, tag: string }> = [];

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
                  this.handleStartDownload(urls, modInfo, fileName, events, callback,
                                           redownload, options));
    // this is a bit of a hack that lets callers intercept a queued download that was not started
    // yet (e.g. it may be waiting to ensure the download dir exists)
    // for this to work the modInfo of the download has to contain a referenceTag corresponding to
    // the tag passed here
    events.on('intercept-download', (tag) => {
      this.mInterceptedDownloads.push({ time: Date.now(), tag });
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
          // this is a cleanup step. If the file doesn' exist that's fine with me
          .catch({ code: 'ENOENT' }, () => Promise.resolve())
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
      this.mApi.store.dispatch(removeDownload(id));
      return this.handleUnknownDownloadError(err, id, callback);
    } else {
      return this.handleUnknownDownloadError(err, id, callback);
    }

    return Promise.resolve();
  }

  private handleStartDownload(urls: string[],
                              modInfo: any,
                              fileName: string,
                              events: NodeJS.EventEmitter,
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
    if (typeof(urls) !== 'function') {
      if (!Array.isArray(urls)) {
        // could happen if triggered by foreign extensions, can't prevent that.
        // During beta it also happened in our own code but that should be fixed
        log('warn', 'invalid url list', { urls });
        urls = [];
      }
      urls = urls.filter(url => url !== undefined);
      if (urls.length === 0) {
        if (callback !== undefined) {
          callback(new ProcessCanceled('URL not usable, only ftp, http and https are supported.'));
        }
        return;
      }
    }

    const state: IState = this.mApi.store.getState();
    let gameMode = (modInfo || {}).game || selectors.activeGameId(state);
    if (Array.isArray(gameMode)) {
      gameMode = gameMode[0];
    }

    if (gameMode === undefined) {
      if (callback !== undefined) {
        callback(new ProcessCanceled(
            'You need to select a game to manage before downloading this file'));
      }
      return;
    }

    this.mApi.store.dispatch(
      initDownload(id, typeof(urls) ===  'function' ? [] : urls, modInfo, gameMode));

    const downloadPath = selectors.downloadPathForGame(state, gameMode);

    const processCB = this.genProgressCB(id);

    const downloadOptions = this.getExtraDlOptions(modInfo, redownload);

    const urlIn = urls[0].split('<')[0];

    return withContext(`Downloading "${fileName || urlIn}"`, urlIn, () =>
      ensureDownloadsDirectory(this.mApi)
        .then(() => {
          if (this.wasIntercepted(modInfo.referenceTag)) {
            return Promise.reject(new UserCanceled());
          }

          return this.mManager.enqueue(id, urls, fileName, processCB,
                                       downloadPath, downloadOptions);
          })
        .catch(AlreadyDownloaded, err => {
          const downloads = this.mApi.getState().persistent.downloads.files;
          const dlId = Object.keys(downloads)
            .find(iter => downloads[iter].localPath === err.fileName);
          log('info', 'about to enqueue', { id, tag: modInfo?.referenceTag });
          if ((dlId !== undefined) && (downloads[dlId].state !== 'failed')) {
            err.downloadId = dlId;
            return Promise.reject(err);
          } else if (this.wasIntercepted(modInfo.referenceTag)) {
            return Promise.reject(new UserCanceled());
          } else {
            // there is a file but with no meta data. force the download instead
            downloadOptions.redownload = 'replace';
            return this.mManager.enqueue(id, urls, fileName, processCB,
                                         downloadPath, downloadOptions);
          }
        })
        .then((res: IDownloadResult) => {
          log('debug', 'download finished', { id, file: res.filePath });
          return this.handleDownloadFinished(id, callback, res, options?.allowInstall ?? true);
        })
        .catch(err => this.handleDownloadError(err, id, downloadPath,
                                               options?.allowOpenHTML ?? true, callback)))
        .finally(() => {
          if ((callback !== undefined) && !callbacked) {
            callback(new ProcessCanceled('forgot to invoke the callback: ' + id));
          }
        });
  }

  private handleDownloadFinished(id: string,
                                 callback: (error: Error, id: string) => void,
                                 res: IDownloadResult,
                                 allowInstall: boolean) {
    const download = this.mApi.store.getState().persistent.downloads.files?.[id];
    if (download === undefined) {
      // The only way for the download entry to be missing at this point
      //  is if the user had canceled the download which would mean it was
      //  removed from the state and the file no longer exists.
      callback?.(new UserCanceled(), id);
      return;
    }
    const fileName = path.basename(res.filePath);
    if (truthy(fileName)) {
      log('debug', 'setting final download name', { id, fileName });
      this.mApi.store.dispatch(setDownloadFilePath(id, fileName));
    } else {
      log('error', 'finished download has no filename?', res);
    }
    log('debug', 'unfinished chunks', { chunks: JSON.stringify(res.unfinishedChunks) });

    const onceFinished = () => {
      if (this.mOnFinishCBs[id] !== undefined) {
        return Promise.all(this.mOnFinishCBs[id].map(cb => cb())).then(() => null);
      } else {
        return Promise.resolve();
      }
    };

    if (res.unfinishedChunks.length > 0) {
      this.mApi.store.dispatch(pauseDownload(id, true, res.unfinishedChunks));
      callback?.(null, id);
      return onceFinished();
    } else if (res.filePath.toLowerCase().endsWith('.html')) {
      this.mApi.store.dispatch(downloadProgress(id, res.size, res.size, [], undefined));
      this.mApi.store.dispatch(finishDownload(id, 'redirect', {htmlFile: res.filePath}));
      this.mApi.events.emit('did-finish-download', id, 'redirect');
      callback?.(new Error('html result'), id);
      return onceFinished();
    } else {
      return finalizeDownload(this.mApi, id, res.filePath, allowInstall)
        .then(() => {
          const flattened = flatten(res.metaInfo ?? {});
          Object.keys(flattened).forEach(key =>
              this.mApi.store.dispatch(setDownloadModInfo(id, key, flattened[key])));

          const state = this.mApi.getState();
          if (state.settings.automation?.install && allowInstall) {
            this.mApi.events.emit('start-install-download', id);
          }

          callback?.(null, id);
        })
        .catch(err => callback?.(err, id))
        .finally(() => onceFinished());
    }
  }

  private genProgressCB(id: string): ProgressCallback {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    return (received: number, total: number, chunks: IChunk[], chunkable: boolean,
            urls?: string[], filePath?: string) => {
      // avoid updating too frequently because it causes ui updates
      const now = Date.now();
      const newPerc = Math.floor((received * 100) / total);
      const small = ((now - lastUpdateTick) < 1000) || (newPerc === lastUpdatePerc);
      if (!small) {
        lastUpdateTick = now;
        lastUpdatePerc = newPerc;
      }
      progressUpdate(this.mApi.store, id, received, total, chunks, chunkable,
                     urls, filePath, small);
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
        const gameId = getDownloadGames(download)[0];
        const dlPath = truthy(gameId)
          ? selectors.downloadPathForGame(this.mApi.store.getState(), gameId)
          : selectors.downloadPath(this.mApi.store.getState());

        return fs.removeAsync(path.join(dlPath, download.localPath))
          .then(() => {
            this.mApi.store.dispatch(removeDownload(downloadId));
            callCB(null);
          })
          .catch(UserCanceled, callCB)
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
        return Promise.resolve();
      }
    };

    if (['init', 'started'].includes(download.state)) {
      // need to cancel the download
      if (!this.mManager.stop(downloadId)) {
        // error case, for some reason the manager didn't know about this download, maybe some
        // delay?
        this.mInterceptedDownloads.push(
          { time: Date.now(), tag: download.modInfo.referenceTag });
        onceStopped();
      } else {
        this.queueFinishCB(downloadId, () => onceStopped());
      }
    } else {
      onceStopped();
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
          tag: download.modInfo.referenceTag,
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
        const downloadPath = selectors.downloadPathForGame(this.mApi.store.getState(), gameMode);

        const fullPath = path.join(downloadPath, download.localPath);
        this.mApi.store.dispatch(pauseDownload(downloadId, false, undefined));

        const extraInfo = this.getExtraDlOptions(download.modInfo, 'always');

        withContext(`Resuming "${download.localPath}"`, download.urls[0], () => {
          if (download.state === 'failed') {
            return ensureDownloadsDirectory(this.mApi)
              .then(() => this.mManager.enqueue(downloadId, download.urls,
                path.basename(fullPath), this.genProgressCB(downloadId),
                undefined, { redownload: 'replace' }))
              .then(res => {
                log('debug', 'download finished (re-tried)', { file: res.filePath });
                return this.handleDownloadFinished(downloadId, callback, res,
                                                   options?.allowInstall ?? true);
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
                return this.handleDownloadFinished(downloadId, callback, res,
                                                   options?.allowInstall ?? true);
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

  private handleUnknownDownloadError(err: any,
                                     downloadId: string,
                                     callback?: (err: Error, id?: string) => void) {
    if (['ESOCKETTIMEDOUT', 'ECONNRESET', 'EBADF'].includes(err.code)) {
      // may be resumable
      this.handlePauseDownload(downloadId);
      if (callback !== undefined) {
        callback(new TemporaryError('I/O Error'), downloadId);
      } else {
        showError(this.mApi.store.dispatch, 'Download failed',
          'The download failed due to an I/O error (network or writing to disk). '
          + 'This is likely a temporary issue, please try resuming later.', {
          allowReport: false,
        });
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
      if (callback !== undefined) {
        callback(err, downloadId);
      } else {
        showError(this.mApi.store.dispatch, 'Download failed',
          err.message, {
          allowReport: false,
        });
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
