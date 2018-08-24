import { IState } from '../../types/IState';
import {ProcessCanceled, UserCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {showError} from '../../util/message';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { showURL } from '../browser/actions';

import {
  downloadProgress,
  finishDownload,
  initDownload,
  pauseDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadHash,
} from './actions/state';
import {IChunk} from './types/IChunk';
import {IDownload} from './types/IDownload';
import { IDownloadResult } from './types/IDownloadResult';
import { ProgressCallback } from './types/ProgressCallback';
import { IProtocolHandlers } from './types/ProtocolHandlers';
import getDownloadGames from './util/getDownloadGames';

import DownloadManager, { DownloadIsHTML, URLFunc } from './DownloadManager';

import * as Promise from 'bluebird';
import {IHashResult} from 'modmeta-db';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

import * as nodeURL from 'url';
import * as util from 'util';
import { downloadPathForGame } from '../../util/selectors';

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
  private mStore: Redux.Store<any>;
  private mManager: DownloadManager;
  private mProtocolHandlers: IProtocolHandlers;

  constructor(events: NodeJS.EventEmitter, store: Redux.Store<any>,
              manager: DownloadManager, protocolHandlers: IProtocolHandlers) {
    this.mStore = store;
    this.mManager = manager;
    this.mProtocolHandlers = protocolHandlers;

    events.on('remove-download',
              downloadId => this.handleRemoveDownload(downloadId));
    events.on('pause-download',
              downloadId => this.handlePauseDownload(downloadId));
    events.on('resume-download',
              (downloadId, callback?) => this.handleResumeDownload(downloadId, callback));
    events.on('start-download',
              (urls, modInfo, fileName?, callback?) =>
                  this.handleStartDownload(urls, modInfo, fileName, events, callback));
  }

  private transformURLS(urls: string[] | URLFunc): Promise<string[] | URLFunc> {
    const transform = (input: string[]) => Promise.all(input.map((inputUrl: string) => {
      const protocol = nodeURL.parse(inputUrl).protocol;
      const handler = this.mProtocolHandlers[protocol];
      return (handler !== undefined)
        ? handler(inputUrl)
        : Promise.resolve([inputUrl]);
    }))
    .reduce((prev: string[], current: string[]) => prev.concat(current), []);

    if (typeof(urls) === 'function') {
      return Promise.resolve(() => {
        return urls()
        .then(resolved => transform(resolved)); });
    } else {
      return transform(urls);
    }
  }

  private translateError(err: any): { message: string, url?: string } {
    const details: any = {
      message: err.message,
    };
    if (err.http_headers !== undefined) {
      if (err.http_headers.nexuserror !== undefined) {
        details.message = err.http_headers.nexuserrorinfo;
      } else if (err.http_headers.status !== undefined) {
        details.message = err.http_headers.status;
      }
    } else if (err.code !== undefined) {
      if (err.code === 'ENOSPC') {
        details.message = 'The disk is full';
      } else if (err.code === 'ECONNRESET') {
        details.message = 'Server refused the connection';
      }
    }

    if (err.request !== undefined) {
      details.url = err.request;
    }
    return details;
  }

  private handleStartDownload(urls: string[] | URLFunc,
                              modInfo: any,
                              fileName: string,
                              events: NodeJS.EventEmitter,
                              callback?: (error: Error, id?: string) => void) {
    const id = shortid();
    if (typeof(urls) !== 'function') {
      urls = urls.filter(url =>
          (url !== undefined)
          && (['ftp:', 'http:', 'https:'].indexOf(nodeURL.parse(url).protocol) !== -1));
      if (urls.length === 0) {
        if (callback !== undefined) {
          callback(new ProcessCanceled('URL not usable, only ftp, http and https are supported.'));
        }
        return;
      }
    }

    const state: IState = this.mStore.getState();
    const gameMode = modInfo.game || selectors.activeGameId(state);

    if (gameMode === undefined) {
      if (callback !== undefined) {
        callback(new ProcessCanceled(
            'You need to select a game to manage before downloading this file'));
      }
      return;
    }

    this.mStore.dispatch(
      initDownload(id, typeof(urls) ===  'function' ? [] : urls, modInfo, gameMode));

    const downloadPath = downloadPathForGame(state, gameMode);

    const processCB = this.genProgressCB(id);

    return this.transformURLS(urls)
        .then(derivedUrls => this.mManager.enqueue(id, derivedUrls, fileName, processCB,
                                                   downloadPath))
        .then((res: IDownloadResult) => {
          log('debug', 'download finished', { file: res.filePath });
          this.handleDownloadFinished(id, callback, res);
        })
        .catch(DownloadIsHTML, err => {
          const innerState: IState = this.mStore.getState();
          const filePath: string =
            getSafe(innerState.persistent.downloads.files, [id, 'localPath'], undefined);

          this.mStore.dispatch(removeDownload(id));
          this.mStore.dispatch(showURL(urls[0]));
          if (callback !== undefined) {
            callback(err, id);
          }
          if (filePath !== undefined) {
            fs.removeAsync(path.join(downloadPath, filePath));
          }
        })
        .catch(UserCanceled, () => {
          this.mStore.dispatch(removeDownload(id));
        })
        .catch((err: any) => {
          const details: { message: string, url?: string } = this.translateError(err);
          log('warn', 'download failed', {message: details.message, err: util.inspect(err)});
          showError(this.mStore.dispatch, 'Download failed', details, {
            allowReport: false,
          });
          this.mStore.dispatch(finishDownload(id, 'failed', { message: details.message }));
          if (callback !== undefined) {
            callback(err, id);
          }
        });
  }

  private handleDownloadFinished(id: string,
                                 callback: (error: Error, id: string) => void,
                                 res: IDownloadResult) {
    const fileName = path.basename(res.filePath);
    const state: IState = this.mStore.getState();
    if (truthy(fileName)) {
      log('debug', 'setting final download name', { id, fileName });
      this.mStore.dispatch(setDownloadFilePath(id, fileName));
    } else {
      log('error', 'finished download has no filename?', res);
    }
    log('debug', 'unfinished chunks', { chunks: res.unfinishedChunks });
    if (res.unfinishedChunks.length > 0) {
      this.mStore.dispatch(pauseDownload(id, true, res.unfinishedChunks));
    } else if (res.filePath.toLowerCase().endsWith('.html')) {
      this.mStore.dispatch(downloadProgress(id, res.size, res.size, [], undefined));
      this.mStore.dispatch(
          finishDownload(id, 'redirect', {htmlFile: res.filePath}));
      if (callback !== undefined) {
        callback(new Error('html result'), id);
      }
    } else {
      const {genHash} = require('modmeta-db');
      genHash(res.filePath)
          .then((md5Hash: IHashResult) => {
            this.mStore.dispatch(setDownloadHash(id, md5Hash.md5sum));
          })
          .catch(err => callback(err, id))
          .finally(() => {
            this.mStore.dispatch(finishDownload(id, 'finished', undefined));

            if (callback !== undefined) {
              callback(null, id);
            }
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
      progressUpdate(this.mStore, id, received, total, chunks,
                     urls, filePath, small);
    };
  }

  private handleRemoveDownload(downloadId: string) {
    const download =
        this.mStore.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to remove download: unknown', {downloadId});
      return;
    }
    if (['init', 'started'].indexOf(download.state) >= 0) {
      // need to cancel the download
      this.mManager.stop(downloadId);
    }
    if (truthy(download.localPath) && truthy(download.game)) {
      const dlPath = downloadPathForGame(this.mStore.getState(), getDownloadGames(download)[0]);
      fs.removeAsync(path.join(dlPath, download.localPath))
          .then(() => { this.mStore.dispatch(removeDownload(downloadId)); })
          .catch(err => {
            showError(this.mStore.dispatch, 'Failed to remove file', err, {
                      allowReport: ['EBUSY', 'EPERM'].indexOf(err.code) === -1 });
          });
    } else {
      this.mStore.dispatch(removeDownload(downloadId));
    }
  }

  private handlePauseDownload(downloadId: string) {
    const download =
        this.mStore.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to pause download: unknown', {downloadId});
      return;
    }
    if (['init', 'started'].indexOf(download.state) >= 0) {
      this.mManager.pause(downloadId);
    }
  }

  private handleResumeDownload(downloadId: string,
                               callback?: (error: Error, id: string) => void) {
    const download: IDownload =
        this.mStore.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to resume download: unknown', {downloadId});
      return;
    }
    if (download.state === 'paused') {
      const gameMode = getDownloadGames(download)[0];
      const downloadPath = downloadPathForGame(this.mStore.getState(), gameMode);

      const fullPath = path.join(downloadPath, download.localPath);
      this.mStore.dispatch(pauseDownload(downloadId, false, undefined));
      this.mManager.resume(downloadId, fullPath, download.urls,
                           download.received, download.size, download.startTime, download.chunks,
                           this.genProgressCB(downloadId))
          .then(res => {
            log('debug', 'download finished (resumed)', { file: res.filePath });
            this.handleDownloadFinished(downloadId, callback, res);
          })
          .catch(err => {
            const details = this.translateError(err);

            this.mStore.dispatch(finishDownload(downloadId, 'failed',
                                                { message: details.message }));
            if (callback !== undefined) {
              callback(err, null);
            }
          });
    }
  }
}

/**
 * hook up the download manager to handle internal events
 *
 */
function observe(events: NodeJS.EventEmitter, store: Redux.Store<any>,
                 manager: DownloadManager, protocolHandlers: IProtocolHandlers) {
  return new DownloadObserver(events, store, manager, protocolHandlers);
}

export default observe;
