import { IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import ReduxProp from '../../util/ReduxProp';
import { activeGameId, downloadPath } from '../../util/selectors';

import { addLocalDownload, removeDownload, setDownloadHashByFile,
         setDownloadSpeed } from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import { IDownload } from './types/IDownload';
import { ProtocolHandlers } from './types/ProtocolHandlers';
import Dashlet from './views/Dashlet';
import {} from './views/DownloadView';
import {} from './views/Settings';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';
import observe from './DownloadObserver';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import {createSelector} from 'reselect';
import {generate as shortid} from 'shortid';

const app = remote !== undefined ? remote.app : appIn;

let observer;
const protocolHandlers: ProtocolHandlers = {};

function refreshDownloads(downloadPath: string, knownDLs: string[],
                          onAddDownload: (name: string) => void,
                          onRemoveDownloads: (name: string[]) => void) {
  return fs.ensureDirAsync(downloadPath)
    .then(() => {
      return fs.readdirAsync(downloadPath);
    })
    .then((downloadNames: string[]) => {
      const addedDLs = downloadNames.filter((name: string) => knownDLs.indexOf(name) === -1);
      const removedDLs = knownDLs.filter((name: string) => downloadNames.indexOf(name) === -1);

      return Promise.map(addedDLs, (modName: string) => {
        onAddDownload(modName);
      })
        .then(() => {
          onRemoveDownloads(removedDLs);
        });
    });
}

export type ProtocolHandler = (inputUrl: string) => Promise<string[]>;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string, handler: ProtocolHandler) => void;
}

function init(context: IExtensionContextExt): boolean {
  const downloadCount = new ReduxProp(context.api, [
    ['persistent', 'downloads', 'files'],
    ], (downloads: { [dlId: string]: IDownload }) => {
      const count = Object.keys(downloads).filter(
        id => ['init', 'started', 'paused'].indexOf(downloads[id].state) !== -1).length;
      return count > 0 ? count : undefined;
    });

  context.registerMainPage('download', 'Download',
                           LazyComponent('./views/DownloadView', __dirname), {
                             hotkey: 'D',
                             group: 'global',
                             badge: downloadCount,
                           });

  context.registerSettings('Download', LazyComponent('./views/Settings', __dirname));

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerReducer(['persistent', 'downloads'], stateReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

  context.registerDashlet('downloads', 1, 300, Dashlet,
    (state: any) => state.persistent.downloads.speedHistory.length > 1);

  context.registerDownloadProtocol = (schema: string, handler: ProtocolHandler) => {
    protocolHandlers[schema] = handler;
  };

  context.once(() => {
    const DownloadManagerImpl: typeof DownloadManager = require('./DownloadManager').default;
    const observeImpl: typeof observe = require('./DownloadObserver').default;

    const store = context.api.store;

    context.api.registerProtocol('http', url => {
        context.api.events.emit('start-download', [url], {});
    });

    context.api.registerProtocol('https', url => {
        context.api.events.emit('start-download', [url], {});
    });

    context.api.events.on('gamemode-activated', () => {
      const currentDownloadPath = downloadPath(store.getState());

      const downloads: { [id: string]: IDownload } = store.getState().persistent.downloads.files;
      const gameId: string = activeGameId(store.getState());
      const knownDLs = Object.keys(downloads)
        .filter((dlId: string) => downloads[dlId].game === gameId)
        .map((dlId: string) => downloads[dlId].localPath);
      const nameIdMap = {};
      Object.keys(downloads).forEach((dlId: string) => nameIdMap[downloads[dlId].localPath] = dlId);
      refreshDownloads(currentDownloadPath, knownDLs, (downloadPath: string) => {
        fs.statAsync(path.join(currentDownloadPath, downloadPath))
          .then((stats: fs.Stats) => {
            const dlId = shortid();
            context.api.store.dispatch(addLocalDownload(dlId, gameId, downloadPath, stats.size));
          });
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => {
          context.api.store.dispatch(removeDownload(nameIdMap[name]));
        });
      })
        .then(() => {
          manager.setDownloadPath(currentDownloadPath);
          context.api.events.emit('downloads-refreshed');
        });
    });

    context.api.events.on('filehash-calculated',
      (filePath: string, fileMD5: string, fileSize: number) => {
        context.api.store.dispatch(setDownloadHashByFile(path.basename(filePath),
                                   fileMD5, fileSize));
      });

    const manager = new DownloadManagerImpl(
      downloadPath(store.getState()),
      store.getState().settings.downloads.maxParallelDownloads,
      store.getState().settings.downloads.maxChunks,
      (speed: number) => {
        if ((speed !== 0) || (store.getState().persistent.downloads.speed !== 0)) {
          store.dispatch(setDownloadSpeed(speed));
        }
      },
      `Nexus Client v2.${app.getVersion()}`);
    observer = observeImpl(context.api.events, store, manager, protocolHandlers);
  });

  return true;
}

export default init;
