import { IExtensionContext } from '../../types/IExtensionContext';

import { downloadPath } from '../mod_management/selectors';

import { addLocalDownload, removeDownload, setDownloadHashByFile,
         setDownloadSpeed } from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import { IDownload } from './types/IDownload';
import { ProtocolHandlers } from './types/ProtocolHandlers';
import DownloadView from './views/DownloadView';
import Settings from './views/Settings';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';
import observe from './DownloadObserver';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';

const app = remote !== undefined ? remote.app : appIn;

let observer;
let protocolHandlers: ProtocolHandlers = {};

function refreshDownloads(downloadPath: string, knownDLs: string[],
                          onAddDownload: (name: string) => void,
                          onRemoveDownloads: (name: string[]) => void) {
  return fs.ensureDirAsync(downloadPath)
    .then(() => {
      return fs.readdirAsync(downloadPath);
    })
    .then((downloadNames: string[]) => {
      let addedDLs = downloadNames.filter((name: string) => knownDLs.indexOf(name) === -1);
      let removedDLs = knownDLs.filter((name: string) => downloadNames.indexOf(name) === -1);

      return Promise.map(addedDLs, (modName: string) => {
        onAddDownload(modName);
      })
        .then(() => {
          onRemoveDownloads(removedDLs);
        });
    });
}

export interface IProtocolHandler {
  (inputUrl: string): Promise<string[]>;
}

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string, handler: IProtocolHandler) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('download', 'Download', DownloadView, {
    hotkey: 'D',
  });

  context.registerSettings('Download', Settings);

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerReducer(['persistent', 'downloads'], stateReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

  context.registerDownloadProtocol = (schema: string, handler: IProtocolHandler) => {
    protocolHandlers[schema] = handler;
  };

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode 
  context.once(() => {
    const DownloadManagerImpl: typeof DownloadManager = require('./DownloadManager').default;
    const observeImpl: typeof observe = require('./DownloadObserver').default;

    const store = context.api.store;

    context.api.events.on('gamemode-activated', () => {
      let currentDownloadPath = downloadPath(store.getState());

      let downloads: { [id: string]: IDownload } = store.getState().persistent.downloads.files;
      let gameId: string = store.getState().settings.gameMode.current;
      let knownDLs = Object.keys(downloads).map((dlId: string) => downloads[dlId].localPath);
      let nameIdMap = {};
      Object.keys(downloads).forEach((dlId: string) => nameIdMap[downloads[dlId].localPath] = dlId);
      refreshDownloads(currentDownloadPath, knownDLs, (downloadPath: string) => {
        fs.statAsync(path.join(currentDownloadPath, downloadPath))
          .then((stats: fs.Stats) => {
            let dlId = shortid();
            context.api.store.dispatch(addLocalDownload(dlId, gameId, downloadPath, stats.size));
          });
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => {
          context.api.store.dispatch(removeDownload(nameIdMap[name]));
        });
      })
        .then(() => {
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
      `Nexus Client v2.${app.getVersion()}`
    );
    observer = observeImpl(context.api.events, store, manager, protocolHandlers);
  });

  return true;
}

export default init;
