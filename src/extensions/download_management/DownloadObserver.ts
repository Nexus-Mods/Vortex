import {log} from '../../util/log';
import {showError} from '../../util/message';
import {activeGameId, downloadPath} from '../../util/selectors';

import resolvePath from '../mod_management/util/resolvePath';

import {
  downloadProgress,
  finishDownload,
  initDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadHash,
} from './actions/state';
import { ProtocolHandlers } from './types/ProtocolHandlers';

import DownloadManager from './DownloadManager';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {IHashResult} from 'modmeta-db';
import * as path from 'path';
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
  private mProtocolHandlers: ProtocolHandlers;

  constructor(events: NodeJS.EventEmitter, store: Redux.Store<any>,
              manager: DownloadManager, protocolHandlers: ProtocolHandlers) {
    this.mStore = store;
    this.mManager = manager;
    this.mProtocolHandlers = protocolHandlers;

    events.on('remove-download',
              (downloadId) => this.handleRemoveDownload(downloadId));
    events.on('start-download',
              (urls, modInfo, callback?) =>
                  this.handleStartDownload(urls, modInfo, callback));
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
        .reduce((prev: string[], current: string[]) => {
          return prev.concat(current);
        }, []);
  }

  private handleStartDownload(urls: string[], modInfo: any,
                              callback?: (error: Error, id: string) => void) {
    let id = shortid();
    let gameMode = modInfo.game || activeGameId(this.mStore.getState());
    this.mStore.dispatch(initDownload(id, urls, modInfo, gameMode));

    const downloadPath = resolvePath('download',
      this.mStore.getState().settings.mods.paths, gameMode);

    let filePath: string;

    return this.transformURLS(urls)
        .then((derivedUrls: string[]) => {
          return this.mManager.enqueue(
              id, derivedUrls,
              (received: number, total: number, updatedFilePath?: string) =>
                  progressUpdate(this.mStore, id, received, total,
                                 updatedFilePath),
              downloadPath);
        })
        .then((res: {filePath: string, headers: any}) => {
          filePath = res.filePath;
          this.mStore.dispatch(setDownloadFilePath(id, path.basename(res.filePath)));
          if (res.filePath.endsWith('.html')) {
            this.mStore.dispatch(
                finishDownload(id, 'failed', {htmlFile: res.filePath}));
            if (callback !== undefined) {
              callback(new Error('html result'), id);
            }
          } else {
            const { genHash } = require('modmeta-db');
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
        })
        .catch((err) => {
          let message;
          if (err.http_headers !== undefined) {
            if (err.http_headers.nexuserror !== undefined) {
              message = err.http_headers.nexuserrorinfo;
            } else {
              message = err.http_headers.status;
            }
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

  private handleRemoveDownload(downloadId: string) {
    const download =
        this.mStore.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to remove download: unknown', {downloadId});
      return;
    }
    if (['init', 'started'].indexOf(download.state) >= 0) {
      // need to cancel the download
      this.mManager.cancel(downloadId);
    }
    if (download.localPath !== undefined) {
      log('debug', 'will delete', {path: download.localPath});
      this.mStore.dispatch(removeDownload(downloadId));
      fs.removeAsync(path.join(downloadPath(this.mStore.getState()), download.localPath));
    } else {
      this.mStore.dispatch(removeDownload(downloadId));
    }
  }
}

/**
 * hook up the download manager to handle internal events
 *
 */
function observe(events: NodeJS.EventEmitter, store: Redux.Store<any>,
                 manager: DownloadManager, protocolHandlers: ProtocolHandlers) {
  return new DownloadObserver(events, store, manager, protocolHandlers);
}

export default observe;
