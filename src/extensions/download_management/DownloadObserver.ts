import {log} from '../../util/log';
import {showError} from '../../util/message';
import * as selectors from '../../util/selectors';

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
import {IDownload} from './types/IDownload';
import { IDownloadResult } from './types/IDownloadResult';
import { IProtocolHandlers } from './types/ProtocolHandlers';

import DownloadManager from './DownloadManager';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {IHashResult} from 'modmeta-db';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

import * as nodeURL from 'url';
import * as util from 'util';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, filePath?: string) {
  if (total > 0) {
    store.dispatch(downloadProgress(dlId, received, total));
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
              (urls, modInfo, callback?) =>
                  this.handleStartDownload(urls, modInfo, events, callback));
  }

  private transformURLS(urls: string[]): Promise<string[]> {
    return Promise.all(urls.map((inputUrl: string) => {
                    const protocol = nodeURL.parse(inputUrl).protocol;
                    const handler = this.mProtocolHandlers[protocol];
                    if (handler !== undefined) {
                      return handler(inputUrl);
                    } else {
                      return Promise.resolve([inputUrl]);
                    }
                  }))
        .reduce((prev: string[], current: string[]) =>
          prev.concat(current), []);
  }

  private handleStartDownload(urls: string[],
                              modInfo: any,
                              events: NodeJS.EventEmitter,
                              callback?: (error: Error, id: string) => void) {
    const id = shortid();
    const gameMode = modInfo.game || selectors.activeGameId(this.mStore.getState());
    this.mStore.dispatch(initDownload(id, urls, modInfo, gameMode));

    const downloadPath = resolvePath('download',
      this.mStore.getState().settings.mods.paths, gameMode);

    const processCB = this.genProgressCB(id);

    return this.transformURLS(urls)
        .then(derivedUrls => this.mManager.enqueue(id, derivedUrls, processCB,
                                                   downloadPath))
        .then((res: IDownloadResult) => {
          this.handleDownloadFinished(id, callback, res);
        })
        .catch((err) => {
          let message;
          if (err.http_headers !== undefined) {
            message = (err.http_headers.nexuserror !== undefined)
              ? err.http_headers.nexuserrorinfo
              : err.http_headers.status;
          } else {
            message = err.message;
          }
          log('warn', 'download failed', {message, err: util.inspect(err)});
          showError(this.mStore.dispatch, 'Download failed', message);
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
    if (res.unfinishedChunks.length > 0) {
      this.mStore.dispatch(pauseDownload(id, true, res.unfinishedChunks));
      if (callback !== undefined) {
        callback(null, id);
      }
    } else if (res.filePath.toLowerCase().endsWith('.html')) {
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
          .finally(() => {
            this.mStore.dispatch(finishDownload(id, 'finished'));

            if (callback !== undefined) {
              callback(null, id);
            }
          });
    }
  }

  private genProgressCB(id: string) {
    let lastUpdateTick = 0;
    let lastUpdatePerc = 0;
    return (received: number, total: number, updatedFilePath?: string) => {
      // avoid updating too frequently because it causes ui updates
      const now = new Date().getTime();
      const newPerc = Math.floor((received * 100) / total);
      if ((now - lastUpdateTick < 200) || (newPerc === lastUpdatePerc)) {
        return;
      }
      lastUpdateTick = now;
      lastUpdatePerc = newPerc;
      progressUpdate(this.mStore, id, received, total, updatedFilePath);
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
    if (download.localPath !== undefined) {
      log('debug', 'will delete', {path: download.localPath});
      this.mStore.dispatch(removeDownload(downloadId));
      fs.removeAsync(path.join(selectors.downloadPath(this.mStore.getState()), download.localPath));
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
                           download.received, download.size, download.chunks,
                           this.genProgressCB(downloadId))
          .then(res => this.handleDownloadFinished(downloadId, callback, res));
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
