import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import {ProcessCanceled, UserCanceled} from '../../util/CustomErrors';
import { withContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {renderError, showError} from '../../util/message';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { showURL } from '../browser/actions';

import {
  downloadProgress,
  finishDownload,
  initDownload,
  mergeDownloadModInfo,
  pauseDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadHash,
} from './actions/state';
import {IChunk} from './types/IChunk';
import {IDownload, IDownloadOptions} from './types/IDownload';
import { IDownloadResult } from './types/IDownloadResult';
import { ProgressCallback } from './types/ProgressCallback';
import getDownloadGames from './util/getDownloadGames';

import DownloadManager, { DownloadIsHTML, RedownloadMode, AlreadyDownloaded } from './DownloadManager';

import Promise from 'bluebird';
import {IHashResult} from 'modmeta-db';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, chunks: IChunk[], urls: string[], filePath: string,
                        smallUpdate: boolean) {
  if (store.getState().persistent.downloads.files[dlId] === undefined) {
    // progress for a download that's no longer active
    return;
  }
  if (((total !== 0) && !smallUpdate) || (chunks !== undefined)) {
    store.dispatch(downloadProgress(dlId, received, total, chunks, urls));
  }
  if ((filePath !== undefined) &&
      (path.basename(filePath) !==
       store.getState().persistent.downloads.files[dlId].localPath)) {
    store.dispatch(setDownloadFilePath(dlId, path.basename(filePath)));
  }
}

/**
 * connect the download manager with the main application through events
 *
 * @class DownloadObserver
 */
export class DownloadObserver {
  private mApi: IExtensionApi;
  private mManager: DownloadManager;

  constructor(api: IExtensionApi, manager: DownloadManager) {
    this.mApi = api;
    const events = api.events;
    this.mManager = manager;

    events.on('remove-download',
              (downloadId, callback?) => this.handleRemoveDownload(downloadId, callback));
    events.on('pause-download',
              (downloadId, callback?) => this.handlePauseDownload(downloadId, callback));
    events.on('resume-download',
              (downloadId, callback?) => this.handleResumeDownload(downloadId, callback));
    events.on('start-download',
              (urls, modInfo, fileName?, callback?, redownload?) =>
                  this.handleStartDownload(urls, modInfo, fileName, events, callback, redownload));
  }

  private translateError(err: any): string {
    const t = this.mApi.translate;

    const details = renderError(err);
    return `${t(details.text, {replace: details.parameters})}\n\n`
         + `${t(details.message, { replace: details.parameters })}`;
  }

  private handleStartDownload(urls: string[],
                              modInfo: any,
                              fileName: string,
                              events: NodeJS.EventEmitter,
                              callback?: (error: Error, id?: string) => void,
                              redownload?: RedownloadMode) {
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

    const extraInfo = this.getExtraDlOptions(modInfo, redownload);

    const urlIn = urls[0].split('<')[0];

    return withContext(`Downloading "${fileName || urlIn}"`, urlIn,
                       () => this.mManager.enqueue(id, urls, fileName,
                                                   processCB, downloadPath, extraInfo)
        .then((res: IDownloadResult) => {
          log('debug', 'download finished', { file: res.filePath });
          this.handleDownloadFinished(id, callback, res);
        })
        .catch(DownloadIsHTML, err => {
          const innerState: IState = this.mApi.store.getState();
          const filePath: string =
            getSafe(innerState.persistent.downloads.files, [id, 'localPath'], undefined);

          this.mApi.store.dispatch(removeDownload(id));
          this.mApi.store.dispatch(showURL(err.url));
          if (callback !== undefined) {
            callback(err, id);
          }
          if (filePath !== undefined) {
            fs.removeAsync(path.join(downloadPath, filePath))
              .catch(innerErr => {
                this.mApi.showErrorNotification('Failed to remove failed download', innerErr);
              });
          }
        })
        .catch(UserCanceled, err => {
          this.mApi.store.dispatch(removeDownload(id));
          if (callback !== undefined) {
            callback(err, id);
          }
        })
        .catch(ProcessCanceled, err => {
          const innerState: IState = this.mApi.store.getState();
          const filePath: string =
            getSafe(innerState.persistent.downloads.files, [id, 'localPath'], undefined);
          const prom: Promise<void> = (filePath !== undefined)
            ? fs.removeAsync(path.join(downloadPath, filePath))
              // this is a cleanup step. If the file doesn' exist that's fine with me
              .catch({ code: 'ENOENT' }, () => Promise.resolve())
            : Promise.resolve();

          prom
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
        })
        .catch(AlreadyDownloaded, err => {
          const stateNow = this.mApi.getState();
          const downloads = stateNow.persistent.downloads.files;
          const dlId = Object.keys(downloads)
            .find(iter => downloads[iter].localPath === err.fileName);
          if (dlId !== undefined) {
            err.downloadId = dlId;
          }
          this.handleDownloadError(err, id, callback);
        })
        .catch((err: any) => {
          this.handleDownloadError(err, id, callback);
        }));
  }

  private handleDownloadFinished(id: string,
                                 callback: (error: Error, id: string) => void,
                                 res: IDownloadResult) {
    const fileName = path.basename(res.filePath);
    if (truthy(fileName)) {
      log('debug', 'setting final download name', { id, fileName });
      this.mApi.store.dispatch(setDownloadFilePath(id, fileName));
    } else {
      log('error', 'finished download has no filename?', res);
    }
    log('debug', 'unfinished chunks', { chunks: JSON.stringify(res.unfinishedChunks) });
    if (res.unfinishedChunks.length > 0) {
      this.mApi.store.dispatch(pauseDownload(id, true, res.unfinishedChunks));
    } else if (res.filePath.toLowerCase().endsWith('.html')) {
      this.mApi.store.dispatch(downloadProgress(id, res.size, res.size, [], undefined));
      this.mApi.store.dispatch(finishDownload(id, 'redirect', {htmlFile: res.filePath}));
      this.mApi.events.emit('did-finish-download', id, 'redirect');
      if (callback !== undefined) {
        callback(new Error('html result'), id);
      }
    } else {
      const {genHash} = require('modmeta-db');
      genHash(res.filePath)
          .then((md5Hash: IHashResult) => {
            this.mApi.store.dispatch(setDownloadHash(id, md5Hash.md5sum));
            if (callback !== undefined) {
              callback(null, id);
            }
          })
          .catch(err => {
            if (callback !== undefined) {
              callback(err, id);
            }
          })
          .finally(() => {
            // still storing the download as successful even if we didn't manage to calculate its
            // hash
            if (res.metaInfo !== undefined) {
              this.mApi.store.dispatch(mergeDownloadModInfo(id, res.metaInfo));
            }
            this.mApi.store.dispatch(finishDownload(id, 'finished', undefined));
            this.mApi.events.emit('did-finish-download', id, 'finished');
          });
    }
  }

  private genProgressCB(id: string): ProgressCallback {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    return (received: number, total: number, chunks: IChunk[],
            urls?: string[], filePath?: string) => {
      // avoid updating too frequently because it causes ui updates
      const now = Date.now();
      const newPerc = Math.floor((received * 100) / total);
      const small = ((now - lastUpdateTick) < 1000) || (newPerc === lastUpdatePerc);
      if (!small) {
        lastUpdateTick = now;
        lastUpdatePerc = newPerc;
      }
      progressUpdate(this.mApi.store, id, received, total, chunks,
                     urls, filePath, small);
    };
  }

  private handleRemoveDownload(downloadId: string, cb?: (err: Error) => void) {
    const download =
        this.mApi.store.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to remove download: unknown', {downloadId});
      return;
    }

    const callCB = (err: Error) => {
      if (cb !== undefined) {
        cb(err);
      }
    }

    if (['init', 'started'].indexOf(download.state) >= 0) {
      // need to cancel the download
      this.mManager.stop(downloadId);
    }
    if (truthy(download.localPath) && truthy(download.game)) {
      const dlPath = selectors.downloadPathForGame(this.mApi.store.getState(),
                                                   getDownloadGames(download)[0]);
      fs.removeAsync(path.join(dlPath, download.localPath))
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
                allowReport: ['EBUSY', 'EPERM'].indexOf(err.code) === -1
              });
            }
          });
    } else {
      this.mApi.store.dispatch(removeDownload(downloadId));
      callCB(null);
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
    if (['init', 'started'].indexOf(download.state) >= 0) {
      if (this.mManager.pause(downloadId) === undefined) {
        // this indicates the download isn't actually running
        this.mApi.store.dispatch(pauseDownload(downloadId, true, download.chunks));
      }
      if (callback !== undefined) {
        callback(null);
      }
    }
  }

  private handleResumeDownload(downloadId: string,
                               callback?: (error: Error, id: string) => void) {
    try {
      const download: IDownload =
        this.mApi.store.getState().persistent.downloads.files[downloadId];
      if (download === undefined) {
        log('warn', 'failed to resume download: unknown', { downloadId });
        return;
      }
      if (download.state === 'paused') {
        const gameMode = getDownloadGames(download)[0];
        const downloadPath = selectors.downloadPathForGame(this.mApi.store.getState(), gameMode);

        const fullPath = path.join(downloadPath, download.localPath);
        this.mApi.store.dispatch(pauseDownload(downloadId, false, undefined));

        const extraInfo = this.getExtraDlOptions(download.modInfo, 'always');

        withContext(`Resuming "${download.localPath}"`, download.urls[0], () =>
          this.mManager.resume(downloadId, fullPath, download.urls,
            download.received, download.size, download.startTime, download.chunks,
            this.genProgressCB(downloadId), extraInfo)
            .then(res => {
              log('debug', 'download finished (resumed)', { file: res.filePath });
              this.handleDownloadFinished(downloadId, callback, res);
            })
            .catch(UserCanceled, err => {
              this.mApi.store.dispatch(removeDownload(downloadId));
              if (callback !== undefined) {
                callback(err, downloadId);
              }
            })
            .catch(err => this.handleDownloadError(err, downloadId, callback)));
      }
    } catch (err) {
      if (callback !== undefined) {
        callback(err, downloadId);
      }
    }
  }

  private handleDownloadError(err: any,
                              downloadId: string,
                              callback?: (err: Error, id?: string) => void) {
    if (['ESOCKETTIMEDOUT', 'ECONNRESET'].indexOf(err.code) !== -1) {
      // may be resumable
      // this.mManager.pause(downloadId);
      if (callback !== undefined) {
        callback(null, downloadId);
      }
    } else {
      const message = this.translateError(err);

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
  }

  private getExtraDlOptions(modInfo: any, redownload: RedownloadMode): IDownloadOptions {
    return {
      referer: modInfo.referer,
      redownload,
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
