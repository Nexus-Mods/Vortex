import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import LazyComponent from '../../util/LazyComponent';
import ReduxProp from '../../util/ReduxProp';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { sum } from '../../util/util';

import {
  addLocalDownload,
  pauseDownload,
  removeDownload,
  setDownloadHashByFile,
  setDownloadInterrupted,
  setDownloadSpeed,
} from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import { IDownload } from './types/IDownload';
import { IProtocolHandlers } from './types/ProtocolHandlers';
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
const protocolHandlers: IProtocolHandlers = {};

function refreshDownloads(downloadPath: string, knownDLs: string[],
                          onAddDownload: (name: string) => void,
                          onRemoveDownloads: (name: string[]) => void) {
  return fs.ensureDirAsync(downloadPath)
    .then(() => fs.readdirAsync(downloadPath))
    .filter((filePath: string) =>
      fs.statAsync(path.join(downloadPath, filePath))
      .then(stat => !stat.isDirectory()).catch(() => false))
    .then((downloadNames: string[]) => {
      const addedDLs = downloadNames.filter((name: string) => knownDLs.indexOf(name) === -1);
      const removedDLs = knownDLs.filter((name: string) => downloadNames.indexOf(name) === -1);

      return Promise.map(addedDLs, (modName: string) =>
        onAddDownload(modName))
        .then(() => onRemoveDownloads(removedDLs));
    });
}

export type ProtocolHandler = (inputUrl: string) => Promise<string[]>;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string, handler: ProtocolHandler) => void;
}

function attributeExtractor(input: any) {
  return Promise.resolve({
    fileName: getSafe(input, ['download', 'localPath'], undefined),
    fileMD5: getSafe(input, ['download', 'fileMD5'], undefined),
    fileSize: getSafe(input, ['download', 'size'], undefined),
    source: getSafe(input, ['download', 'modInfo', 'source'], undefined),
    downloadGame: getSafe(input, ['download', 'game'], undefined),
  });
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

  context.registerDashlet('Downloads', 1, 2, 300, Dashlet);

  context.registerDownloadProtocol = (schema: string, handler: ProtocolHandler) => {
    protocolHandlers[schema] = handler;
  };

  context.registerAttributeExtractor(150, attributeExtractor);

  context.once(() => {
    const DownloadManagerImpl: typeof DownloadManager = require('./DownloadManager').default;
    const observeImpl: typeof observe = require('./DownloadObserver').default;

    const store = context.api.store;

    let manager: DownloadManager;

    context.api.registerProtocol('http', url => {
      context.api.events.emit('start-download', [url], {});
    });

    context.api.registerProtocol('https', url => {
      context.api.events.emit('start-download', [url], {});
    });

    let currentWatch: fs.FSWatcher;
    context.api.events.on('gamemode-activated', () => {
      const currentDownloadPath = selectors.downloadPath(store.getState());

      const downloads: { [id: string]: IDownload } = store.getState().persistent.downloads.files;
      const gameId: string = selectors.activeGameId(store.getState());
      const knownDLs = Object.keys(downloads)
        .filter((dlId: string) => downloads[dlId].game === gameId)
        .map((dlId: string) => downloads[dlId].localPath);

      const nameIdMap: { [name: string]: string } = Object.keys(downloads).reduce((prev, value) => {
        prev[downloads[value].localPath] = value;
        return prev;
      }, {});

      refreshDownloads(currentDownloadPath, knownDLs, (fileName: string) => {
        fs.statAsync(path.join(currentDownloadPath, fileName))
          .then((stats: fs.Stats) => {
            const dlId = shortid();
            context.api.store.dispatch(addLocalDownload(dlId, gameId, fileName, stats.size));
            nameIdMap[fileName] = dlId;
          });
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => {
          context.api.store.dispatch(removeDownload(nameIdMap[name]));
        });
      })
        .then(() => {
          manager.setDownloadPath(currentDownloadPath);
          if (currentWatch !== undefined) {
            currentWatch.close();
          }
          currentWatch = fs.watch(currentDownloadPath, {}, (evt: string, fileName: string) => {
            if (evt === 'rename') {
              const filePath = path.join(currentDownloadPath, fileName);
              fs.statAsync(filePath)
              .then(stats => {
                const dlId = shortid();
                context.api.store.dispatch(addLocalDownload(dlId, gameId, fileName, stats.size));
                nameIdMap[fileName] = dlId;
              })
              .catch(err => {
                if (err.code === 'ENOENT') {
                  context.api.store.dispatch(removeDownload(nameIdMap[fileName]));
                }
              });
            }
          }) as fs.FSWatcher;
          context.api.events.emit('downloads-refreshed');
        });
    });

    context.api.events.on('filehash-calculated',
      (filePath: string, fileMD5: string, fileSize: number) => {
        context.api.store.dispatch(setDownloadHashByFile(path.basename(filePath),
                                   fileMD5, fileSize));
      });

    {
      manager = new DownloadManagerImpl(
          selectors.downloadPath(store.getState()),
          store.getState().settings.downloads.maxParallelDownloads,
          store.getState().settings.downloads.maxChunks, (speed: number) => {
            if ((speed !== 0) || (store.getState().persistent.downloads.speed !== 0)) {
              store.dispatch(setDownloadSpeed(speed));
            }
          }, `Nexus Client v2.${app.getVersion()}`);
      observer =
          observeImpl(context.api.events, store, manager, protocolHandlers);

      const downloads = store.getState().persistent.downloads.files;
      const interruptedDownloads = Object.keys(downloads)
        .filter(id => ['init', 'started'].indexOf(downloads[id].state) !== -1);
      interruptedDownloads.forEach(id => {
        let realSize = (downloads[id].size !== 0)
            ? downloads[id].size - sum(downloads[id].chunks.map(chunk => chunk.size))
            : 0;
        if (isNaN(realSize)) {
          realSize = 0;
        }
        store.dispatch(setDownloadInterrupted(id, realSize));
      });
    }
  });

  return true;
}

export default init;
