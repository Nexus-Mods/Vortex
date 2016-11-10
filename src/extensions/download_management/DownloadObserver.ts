import {log} from '../../util/log';
import {showError} from '../../util/message';

import {
  downloadProgress,
  finishDownload,
  initDownload,
  removeDownload,
  setDownloadFilePath,
} from './actions/state';
import DownloadManager from './DownloadManager';

import * as fs from 'fs-extra-promise';
import {v1} from 'node-uuid';

import * as util from 'util';

function progressUpdate(store: Redux.Store<any>, dlId: string, received: number,
                        total: number, filePath?: string) {
  if (total > 0) {
    store.dispatch(downloadProgress(dlId, received, total));
  }
  if ((filePath !== undefined) &&
      (filePath !==
       store.getState().persistent.downloads.files[dlId].localPath)) {
    store.dispatch(setDownloadFilePath(dlId, filePath));
  }
}

/**
 * hook up the download manager to handle internal events
 *
 */
function observe(events: NodeJS.EventEmitter, store: Redux.Store<any>,
                 manager: DownloadManager) {
  events.on('remove-download', (downloadId: string) => {
    const download = store.getState().persistent.downloads.files[downloadId];
    if (download === undefined) {
      log('warn', 'failed to remove download: unknown', {downloadId});
      return;
    }
    if (['init', 'started'].indexOf(download.state) >= 0) {
      // need to cancel the download
      manager.cancel(downloadId);
    }
    if (download.localPath !== undefined) {
      log('debug', 'will delete', {path: download.localPath});
      store.dispatch(removeDownload(downloadId));
      fs.removeAsync(download.localPath);
    } else {
      store.dispatch(removeDownload(downloadId));
    }
  });

  events.on('start-download', (urls: string[], modInfo: any) => {
    let id = v1();
    store.dispatch(initDownload(id, urls, modInfo));

    let filePath: string;

    manager.enqueue(
               id, urls,
               (received: number, total: number, updatedFilePath?: string) =>
                   progressUpdate(store, id, received, total, updatedFilePath))
        .then((res: {filePath: string, headers: any}) => {
          log('debug', 'download finished');
          filePath = res.filePath;
          store.dispatch(setDownloadFilePath(id, res.filePath));
          if (res.filePath.endsWith('.html')) {
            store.dispatch(
                finishDownload(id, 'failed', {htmlFile: res.filePath}));
          } else {
            store.dispatch(finishDownload(id, 'finished'));
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
          log('warn', 'download failed', { message, err: util.inspect(err) });
          showError(store.dispatch, 'Download failed', message);
          store.dispatch(finishDownload(id, 'failed', {message}));
        });
  });
}

export default observe;
