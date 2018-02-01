import { IState } from '../../types/IState';
import {ProcessCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {showError} from '../../util/message';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { showURL } from '../browser/actions';
import resolvePath from '../mod_management/util/resolvePath';

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

import DownloadManager, { DownloadIsHTML, URLFunc } from './DownloadManager';

import * as Promise from 'bluebird';
import {IHashResult} from 'modmeta-db';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

import * as nodeURL from 'url';
import * as util from 'util';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, chunks: IChunk[], filePath?: string) {
  if (store.getState().persistent.downloads.files[dlId] === undefined) {
    // progress for a download that's no longer active
    return;
  }
  if ((total !== 0) || (chunks !== undefined)) {
    store.dispatch(downloadProgress(dlId, received, total, chunks));
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

  private handleStartDownload(urls: string[] | URLFunc,
                              modInfo: any,
                              fileName: string,
                              events: NodeJS.EventEmitter,
                              callback?: (error: Error, id?: string) => void) {
    const id = shortid();
    if (typeof(urls) !== 'function') {
      urls = urls.filter(url =>
          (url !== undefined)
          && (['ftp', 'http', 'https'].indexOf(nodeURL.parse(url).protocol) !== -1));
      if (urls.length === 0) {
        if (callback !== undefined) {
          callback(new ProcessCanceled('URL not usable, only ftp, http and https are supported.'));
        }
        return;
      }
    }
    const gameMode = modInfo.game || selectors.activeGameId(this.mStore.getState());

    if (gameMode === undefined) {
      if (callback !== undefined) {
        callback(new ProcessCanceled(
            'You need to select a game to manage before downloading this file'));
      }
      return;
    }

    this.mStore.dispatch(initDownload(id, urls, modInfo, gameMode));

    const downloadPath = resolvePath('download',
      this.mStore.getState().settings.mods.paths, gameMode);

    const processCB = this.genProgressCB(id);

    return this.transformURLS(urls)
        .then(derivedUrls => this.mManager.enqueue(id, derivedUrls, fileName, processCB,
                                                   downloadPath))
        .then((res: IDownloadResult) => {
          log('debug', 'download finished', { file: res.filePath });
          this.handleDownloadFinished(id, callback, res);
        })
        .catch(DownloadIsHTML, err => {
          const state: IState = this.mStore.getState();
          const filePath: string =
            getSafe(state.persistent.downloads.files, [id, 'localPath'], undefined);

          this.mStore.dispatch(removeDownload(id));
          this.mStore.dispatch(showURL(urls[0]));
          if (callback !== undefined) {
            callback(err, id);
          }
          if (filePath !== undefined) {
            fs.removeAsync(path.join(downloadPath, filePath));
          }
        })
        .catch((err) => {
          let message = err.message;
          if (err.http_headers !== undefined) {
            if (err.http_headers.nexuserror !== undefined) {
              message = err.http_headers.nexuserrorinfo;
            } else if (err.http_headers.status !== undefined) {
              message = err.http_headers.status;
            }
          }
          log('warn', 'download failed', {message, err: util.inspect(err)});
          showError(this.mStore.dispatch, 'Download failed', message,
                    false, undefined, false);
          this.mStore.dispatch(finishDownload(id, 'failed', {message}));
          if (callback !== undefined) {
            callback(err, id);
          }
        });
  }

  private handleDownloadFinished(id: string,
                                 callback: (error: Error, id: string) => void,
                                 res: IDownloadResult) {
    const filePath = res.filePath;
    this.mStore.dispatch(setDownloadFilePath(id, path.basename(res.filePath)));
    log('debug', 'unfinished chunks', { chunks: res.unfinishedChunks });
    if (res.unfinishedChunks.length > 0) {
      this.mStore.dispatch(pauseDownload(id, true, res.unfinishedChunks));
    } else if (res.filePath.toLowerCase().endsWith('.html')) {
      this.mStore.dispatch(downloadProgress(id, res.size, res.size, []));
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
            this.mStore.dispatch(finishDownload(id, 'finished'));

            if (callback !== undefined) {
              callback(null, id);
            }
          });
    }
  }

  private genProgressCB(id: string): ProgressCallback {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    return (received: number, total: number, chunks: IChunk[], updatedFilePath?: string) => {
      // avoid updating too frequently because it causes ui updates
      const now = new Date().getTime();
      const newPerc = Math.floor((received * 100) / total);
      if ((chunks === undefined)
          && ((now - lastUpdateTick < 200) || (newPerc === lastUpdatePerc))) {
        return;
      }
      lastUpdateTick = now;
      lastUpdatePerc = newPerc;
      progressUpdate(this.mStore, id, received, total, chunks, updatedFilePath);
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
    if (truthy(download.localPath)) {
      const dlPath = resolvePath('download',
          this.mStore.getState().settings.mods.paths, download.game);
      fs.removeAsync(path.join(dlPath, download.localPath))
          .then(() => { this.mStore.dispatch(removeDownload(downloadId)); })
          .catch(err => {
            showError(this.mStore.dispatch, 'Failed to remove file', err, false,
                      undefined, ['EBUSY', 'EPERM'].indexOf(err.code) === -1);
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
      const gameMode = download.game;
      const downloadPath = resolvePath('download',
        this.mStore.getState().settings.mods.paths, gameMode);

      const fullPath = path.join(downloadPath, download.localPath);
      this.mStore.dispatch(pauseDownload(downloadId, false));
      this.mManager.resume(downloadId, fullPath, download.urls,
                           download.received, download.size, download.startTime, download.chunks,
                           this.genProgressCB(downloadId))
          .then(res => {
            log('debug', 'download finished (resumed)', { file: res.filePath });
            this.handleDownloadFinished(downloadId, callback, res);
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
