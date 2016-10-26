import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { downloadPath } from '../mod_management/selectors';

import { downloadProgress, finishDownload, initDownload, removeDownload,
         setDownloadFilePath, setDownloadSpeed} from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import DownloadView from './views/DownloadView';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';

import * as fs from 'fs-extra-promise';
import { v1 } from 'node-uuid';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('download', 'Download', DownloadView, {
    hotkey: 'D',
  });

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerReducer(['persistent', 'downloads'], stateReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode 
  context.once(() => {
    const store = context.api.store;
    const manager = new DownloadManager(
      downloadPath(store.getState()),
      store.getState().settings.downloads.maxParallelDownloads,
      store.getState().settings.downloads.maxChunks,
      (speed: number) => {
        if ((speed !== 0) || (store.getState().persistent.downloads.speed !== 0)) {
          store.dispatch(setDownloadSpeed(speed));
        }
      }
    );

    context.api.events.on('remove-download', (downloadId: string) => {
      const download = store.getState().persistent.downloads.running[downloadId];
      if (download === undefined) {
        log('warn', 'failed to remove download: unknown', { downloadId });
        return;
      }
      if (['init', 'started'].indexOf(download.state) >= 0) {
        // need to cancel the download
        manager.cancel(downloadId);
      }
      if (download.localPath !== undefined) {
        log('debug', 'will delete', { path: download.localPath });
        fs.removeAsync(download.localPath)
          .then(() => {
            store.dispatch(removeDownload(downloadId));
          });
      } else {
        store.dispatch(removeDownload(downloadId));
      }
    });

    context.api.events.on('start-download', (urls: string[], modInfo: any) => {
      let id = v1();
      store.dispatch(initDownload(id, urls, modInfo));

      manager.enqueue(id, urls, (received: number, total: number, filePath?: string) => {
        if (total > 0) {
          store.dispatch(downloadProgress(id, received, total));
        }
        if ((filePath !== undefined) &&
            (filePath !== store.getState().persistent.downloads.running[id].localPath)) {
          store.dispatch(setDownloadFilePath(id, filePath));
        }
      })
      .then((filePath: string) => {
        store.dispatch(setDownloadFilePath(id, filePath));
        store.dispatch(finishDownload(id, 'finished'));
      })
      .catch((err) => {
        store.dispatch(finishDownload(id, 'failed'));
      });
    });
  });

  return true;
}

export default init;
