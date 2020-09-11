import { IDialogResult, setDownloadPath } from '../../actions';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { ITestResult } from '../../types/ITestResult';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import ReduxProp from '../../util/ReduxProp';
import * as selectors from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { sum, truthy } from '../../util/util';

import {
  addLocalDownload,
  downloadProgress,
  removeDownload,
  setDownloadHashByFile,
  setDownloadInterrupted,
  setDownloadModInfo,
  setDownloadSpeed,
  setDownloadSpeeds,
} from './actions/state';

import { setTransferDownloads } from './actions/transactions';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import { transactionsReducer } from './reducers/transactions';
import { IDownload } from './types/IDownload';
import { IProtocolHandlers } from './types/ProtocolHandlers';
import getDownloadGames from './util/getDownloadGames';
import writeDownloadsTag, { DOWNLOADS_DIR_TAG } from './util/writeDownloadsTag';
import DownloadView from './views/DownloadView';
import Settings from './views/Settings';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';
import observe, { DownloadObserver } from './DownloadObserver';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import {generate as shortid} from 'shortid';

const app = remote !== undefined ? remote.app : appIn;

let observer: DownloadObserver;
let manager: DownloadManager;
let updateDebouncer: Debouncer;

const protocolHandlers: IProtocolHandlers = {};

const archiveExtLookup = new Set<string>([
  '.zip', '.z01', '.7z', '.rar', '.r00', '.001', '.bz2', '.bzip2', '.gz', '.gzip',
  '.xz', '.z',
  '.fomod',
]);

const addLocalInProgress = new Set<string>();

function validateDownloadsTag(api: IExtensionApi, tagPath: string): Promise<void> {
  return fs.readFileAsync(tagPath, { encoding: 'utf8' })
    .then(data => {
      const state: IState = api.store.getState();
      const tag = JSON.parse(data);
      if (tag.instance !== state.app.instanceId) {
        return api.showDialog('question', 'Confirm', {
          text: 'This is a downloads folder but it appears to belong to a different Vortex '
              + 'instance. If you\'re using Vortex in shared and "regular" mode, do not use '
              + 'the same downloads folder for both!',
        }, [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => (result.action === 'Cancel')
          ? Promise.reject(new UserCanceled())
          : Promise.resolve());
      }
      return Promise.resolve();
    })
    .catch(() => {
      return api.showDialog('question', 'Confirm', {
        text: 'This directory is not marked as a downloads folder. '
            + 'Are you *sure* it\'s the right directory?',
      }, [
        { label: 'Cancel' },
        { label: 'I\'m sure' },
      ])
      .then(result => result.action === 'Cancel'
        ? Promise.reject(new UserCanceled())
        : Promise.resolve());
    });
}

function knownArchiveExt(filePath: string): boolean {
  if (!truthy(filePath)) {
    return false;
  }
  return archiveExtLookup.has(path.extname(filePath).toLowerCase());
}

function refreshDownloads(downloadPath: string, knownDLs: string[],
                          normalize: (input: string) => string,
                          onAddDownload: (name: string) => Promise<void>,
                          onRemoveDownload: (name: string) => Promise<void>,
                          confirmElevation: () => Promise<void>) {
  return fs.ensureDirWritableAsync(downloadPath, confirmElevation)
    .then(() => fs.readdirAsync(downloadPath))
    .filter((filePath: string) => knownArchiveExt(filePath))
    .filter((filePath: string) =>
      fs.statAsync(path.join(downloadPath, filePath))
      .then(stat => !stat.isDirectory()).catch(() => false))
    .then((downloadNames: string[]) => {
      const dlsNormalized = downloadNames.map(normalize);
      const addedDLs = downloadNames.filter((name: string, idx: number) =>
        knownDLs.indexOf(dlsNormalized[idx]) === -1);
      const removedDLs = knownDLs.filter((name: string) =>
        dlsNormalized.indexOf(name) === -1);

      return Promise.map(addedDLs, onAddDownload)
        .then(() => Promise.map(removedDLs, onRemoveDownload));
    });
}

export interface IResolvedURL {
  urls: string[];
  meta: any;
}

export type ProtocolHandler = (inputUrl: string) => Promise<IResolvedURL>;

export interface IExtensionContextExt extends IExtensionContext {
  // register a download protocol handler
  // TODO: these kinds of handlers are rather limited as they can only return
  // ftp/http/https urls that can be downloaded directly, you can't add
  // meta information about the file.
  registerDownloadProtocol: (schema: string, handler: ProtocolHandler) => void;
}

function attributeExtractor(input: any) {
  let downloadGame: string | string[] = getSafe(input, ['download', 'game'], []);
  if (Array.isArray(downloadGame)) {
    downloadGame = downloadGame[0];
  }
  return Promise.resolve({
    fileName: getSafe(input, ['download', 'localPath'], undefined),
    fileMD5: getSafe(input, ['download', 'fileMD5'], undefined),
    fileSize: getSafe(input, ['download', 'size'], undefined),
    source: getSafe(input, ['download', 'modInfo', 'source'], undefined),
    version: getSafe(input, ['download', 'modInfo', 'version'], undefined),
    logicalFileName: getSafe(input, ['download', 'modInfo', 'name'], undefined),
    downloadGame,
  });
}

function attributeExtractorCustom(input: any) {
  return Promise.resolve(input.download?.modInfo?.custom || {});
}

function genDownloadChangeHandler(api: IExtensionApi,
                                  currentDownloadPath: string,
                                  gameId: string,
                                  nameIdMap: { [name: string]: string },
                                  normalize: Normalize) {
  const updateTimers: { [fileName: string]: NodeJS.Timer } = {};

  const store: Redux.Store<any> = api.store;

  const findDownload = (fileName: string): string => {
    const state = store.getState();
    return Object.keys(state.persistent.downloads.files)
      .find(iterId =>
        state.persistent.downloads.files[iterId].localPath === fileName);
  };

  return (evt: string, fileName: string) => {
    if (!watchEnabled
        || (fileName === undefined)
        || !knownArchiveExt(fileName)) {
      return;
    }

    if (evt === 'update') {
      if (updateTimers[fileName] !== undefined) {
        clearTimeout(updateTimers[fileName]);
        setTimeout(() => {
          fs.statAsync(path.join(currentDownloadPath, fileName))
            .then(stats => {
              const dlId = findDownload(fileName);
              if (dlId !== undefined) {
                store.dispatch(downloadProgress(dlId, stats.size, stats.size, [], undefined));
              }
            });
        }, 5000);
      }
    } else if (evt === 'rename') {
      if (addLocalInProgress.has(fileName)) {
        return;
      }
      // this delay is intended to prevent this from picking up files that Vortex added itself.
      // It is not enough however to prevent this from getting the wrong file size if the file
      // copy/write takes more than this one second.
      Promise.delay(1000)
        .then(() => fs.statAsync(path.join(currentDownloadPath, fileName)))
        .then(stats => {
          let dlId = findDownload(fileName);
          if (dlId === undefined) {
            dlId = shortid();
            log('debug', 'file added to download directory at runtime', fileName);
            store.dispatch(addLocalDownload(dlId, gameId, fileName, stats.size));
            api.events.emit('did-import-downloads', [dlId]);
          }
          nameIdMap[normalize(fileName)] = dlId;
        })
        .catch(err => {
          if ((err.code === 'ENOENT') && (nameIdMap[normalize(fileName)] !== undefined)) {
            // if the file was deleted, remove it from state. This does nothing if
            // the download was already removed so that's fine
            store.dispatch(removeDownload(nameIdMap[normalize(fileName)]));
          }
        });
    }
  };
}

let currentWatch: fs.FSWatcher;
let watchEnabled: boolean = true;

function watchDownloads(api: IExtensionApi, downloadPath: string,
                        onChange: (evt: string, fileName: string) => void) {
  if (currentWatch !== undefined) {
    currentWatch.close();
  }

  try {
    currentWatch = fs.watch(downloadPath, {}, onChange) as fs.FSWatcher;
    currentWatch.on('error', error => {
      // these may happen when the download path gets moved.
        log('warn', 'failed to watch mod directory', { downloadPath, error });
    });
  } catch (err) {
    api.showErrorNotification('Can\'t watch the download directory for changes', err, {
      allowReport: false,
    });
  }
}

function updateDownloadPath(api: IExtensionApi, gameId?: string) {
  const { store } = api;

  const state: IState = store.getState();

  let downloads: {[id: string]: IDownload} = state.persistent.downloads.files;

  // workaround to avoid duplicate entries in the download list. These should not
  // exist, the following block should do nothing
  Object.keys(downloads)
    .filter(dlId => (downloads[dlId].state === 'finished')
                    && !truthy(downloads[dlId].localPath))
    .forEach(dlId => {
      api.store.dispatch(removeDownload(dlId));
    });

  downloads = state.persistent.downloads.files;

  if (gameId === undefined) {
    gameId = selectors.activeGameId(state);
    if (gameId === undefined) {
      return Promise.resolve();
    }
  }
  const currentDownloadPath = selectors.downloadPathForGame(state, gameId);

  let nameIdMap: {[name: string]: string} = {};

  let downloadChangeHandler: (evt: string, fileName: string) => void;
  return getNormalizeFunc(currentDownloadPath, {separators: false, relative: false})
      .then(normalize => {
        nameIdMap = Object.keys(downloads).reduce((prev, value) => {
          if (downloads[value].localPath !== undefined) {
            prev[normalize(downloads[value].localPath)] = value;
          }
          return prev;
        }, {});

        downloadChangeHandler =
          genDownloadChangeHandler(api, currentDownloadPath, gameId, nameIdMap, normalize);

        const knownDLs =
          Object.keys(downloads)
            .filter(dlId => getDownloadGames(downloads[dlId])[0] === gameId)
            .map(dlId => normalize(downloads[dlId].localPath || ''));

        return refreshDownloads(currentDownloadPath, knownDLs, normalize,
          (fileName: string) =>
            fs.statAsync(path.join(currentDownloadPath, fileName))
              .then((stats: fs.Stats) => {
                const dlId = shortid();
                log('debug', 'registering previously unknown archive', fileName);
                store.dispatch(addLocalDownload(dlId, gameId, fileName, stats.size));
                nameIdMap[normalize(fileName)] = dlId;
              }),
          (fileName: string) => {
            // the fileName here is already normalized
            api.store.dispatch(removeDownload(nameIdMap[fileName]));
            return Promise.resolve();
          },
          () => new Promise((resolve, reject) => {
            api.showDialog('question', 'Access Denied', {
              text: 'The download directory is not writable to your user account.\n'
                + 'If you have admin rights on this system, Vortex can change the permissions '
                + 'to allow it write access.',
            }, [
                { label: 'Cancel', action: () => reject(new UserCanceled()) },
                { label: 'Allow access', action: () => resolve() },
              ]);
          }))
          .catch(UserCanceled, () => null)
          .catch(err => {
            api.showErrorNotification('Failed to refresh download directory', err, {
              allowReport: err.code !== 'EPERM',
            });
          });
      })
    .then(() => {
      manager.setDownloadPath(currentDownloadPath);
      watchDownloads(api, currentDownloadPath, downloadChangeHandler);
      api.events.emit('downloads-refreshed');
    })
    .catch(err => {
      api.showErrorNotification('Failed to read downloads directory',
          err, { allowReport: err.code !== 'ENOENT' });
    });
}

function removeDownloadsMetadata(api: IExtensionApi): Promise<void> {
  const state: IState = api.store.getState();
  const downloads: {[id: string]: IDownload} = state.persistent.downloads.files;
  return Promise.each(Object.keys(downloads), dlId => {
    api.store.dispatch(removeDownload(dlId));
    return Promise.resolve();
  }).then(() => Promise.resolve());
}

function queryDownloadFolderInvalid(api: IExtensionApi,
                                    err: Error,
                                    dirExists: boolean,
                                    currentDownloadPath: string)
                                    : Promise<IDialogResult> {
  if (dirExists) {
    // dir exists but not tagged
    return api.showDialog('error', 'Downloads Folder invalid', {
      bbcode: 'Your downloads folder "{{path}}" is not marked correctly. This may be ok '
          + 'if you\'ve updated from a very old version of Vortex and you can ignore this.<br/>'
          + '[b]However[/b], if you use a removable medium (network or USB drive) and that path '
          + 'does not actually point to your real Vortex download folder, you [b]have[/b] '
          + 'to make sure the actual folder is available and tell Vortex where it is.',
      message: err.message,
      parameters: {
        path: currentDownloadPath,
      },
    }, [
      { label: 'Quit Vortex' },
      { label: 'Ignore' },
      { label: 'Browse...' },
    ]);
  }
  return api.showDialog('error', ' Downloads Folder missing!', {
        text: 'Your downloads folder "{{path}}" is missing. This might happen because you '
            + 'deleted it or - if you have it on a removable drive - it is not currently '
            + 'connected.\nIf you continue now, a new downloads folder will be created but all '
            + 'your previous mod archives will be lost.\n\n'
            + 'If you have moved the folder or the drive letter changed, you can browse '
            + 'for the new location manually, but please be extra careful to select the right '
            + 'folder!',
        message: err.message,
        parameters: {
          path: currentDownloadPath,
        },
      }, [
        { label: 'Quit Vortex' },
        { label: 'Reinitialize' },
        { label: 'Browse...' },
      ]);
}

function testDownloadPath(api: IExtensionApi): Promise<void> {
  const state: IState = api.store.getState();
  const gameId = selectors.activeGameId(state);
  const isNewInstallation = (currentState: IState) => {
    // We don't want to run this check if the user has just
    //  installed a fresh copy of Vortex as the downloads folder
    //  has probably not been created yet.
    // It is safe to assume that this is a new installation if
    //  our state holds no mods (for any game) and no download files.
    const gameModes = getSafe(currentState, ['persistent', 'mods'], undefined);
    const gamesWithActiveMods = (gameModes !== undefined)
      ? Object.keys(gameModes).length
      : 0;

    const downloads = getSafe(currentState,
      ['persistent', 'downloads', 'files'], undefined);
    const totalDown = (downloads !== undefined)
      ? Object.keys(downloads).length
      : 0;

    return ((gamesWithActiveMods === 0) && (totalDown === 0));
  };

  if ((gameId === undefined) || isNewInstallation(state)) {
    return Promise.resolve();
  }

  let currentDownloadPath = selectors.downloadPathForGame(state, gameId).replace(gameId, '');
  let dirExists = false;
  const ensureDownloadsDirectory = (): Promise<void> => fs.statAsync(currentDownloadPath)
    .then(() => {
      dirExists = true;
      // download dir exists, does the tag exist?
      return fs.statAsync(path.join(currentDownloadPath, DOWNLOADS_DIR_TAG));
    })
    .catch(err => {
      return queryDownloadFolderInvalid(api, err, dirExists, currentDownloadPath)
        .then(result => {
        if (result.action === 'Quit Vortex') {
          app.exit(0);
          return Promise.reject(new UserCanceled());
        } else if (result.action === 'Reinitialize') {
          const id = shortid();
          api.sendNotification({
            id,
            type: 'activity',
            message: 'Cleaning downloads metadata',
          });
          return removeDownloadsMetadata(api)
            .then(() => fs.ensureDirWritableAsync(currentDownloadPath, () => Promise.resolve()))
            .catch(() => {
              api.showDialog('error', 'Downloads Folder missing!', {
                bbcode: 'The downloads folder could not be created. '
                      + 'You [b][color=red]have[/color][/b] to go to settings->downloads and '
                      + 'change it to a valid directory [b][color=red]before doing anything '
                      + 'else[/color][/b] or you will get further error messages.',
              }, [
                { label: 'Close' },
              ]);
              return Promise.reject(new ProcessCanceled(
                'Failed to reinitialize download directory'));
            })
            .finally(() => {
              api.dismissNotification(id);
            });
        } else if (result.action === 'Ignore') {
          return Promise.resolve();
        } else { // Browse...
          return api.selectDir({
            defaultPath: currentDownloadPath,
            title: api.translate('Select downloads folder'),
          }).then((selectedPath) => {
            if (!truthy(selectedPath)) {
              return Promise.reject(new UserCanceled());
            }
            return validateDownloadsTag(api, path.join(selectedPath, DOWNLOADS_DIR_TAG))
              .then(() => {
                currentDownloadPath = selectedPath;
                api.store.dispatch(setDownloadPath(currentDownloadPath));
                return Promise.resolve();
              });
          })
          .catch(() => ensureDownloadsDirectory());
        }
      });
    })
      .then(() => writeDownloadsTag(api, currentDownloadPath));

  return ensureDownloadsDirectory()
    .catch(ProcessCanceled, () => Promise.resolve())
    .catch(UserCanceled, () => Promise.resolve())
    .catch(err => {
      const errTitle = (err.code === 'EPERM')
        ? 'Insufficient permissions'
        : 'Downloads folder error';

      return new Promise<void>((resolve) => {
        api.showDialog('error', errTitle, {
          text: 'Unable to finalize downloads folder creation/transfer. Please ensure your OS '
              + 'account has full read/write permissions for the target destination and try again. '
              + 'An exception should be added to Anti-Virus apps for Vortex. (where applicable)',
          message: err.message,
        }, [{ label: 'Retry', action: () => resolve() }]);
      })
      .then(() => testDownloadPath(api));
    });
}

function genGameModeActivated(api: IExtensionApi) {
  return () => testDownloadPath(api)
    .then(() => updateDebouncer.schedule());
}

function removeArchive(store: Redux.Store<IState>, destination: string) {
  return fs.removeAsync(destination)
    .then(() => {
      const state = store.getState();
      const fileName = path.basename(destination);
      const { files } = state.persistent.downloads;
      Object.keys(files)
        .filter(dlId => files[dlId].localPath === fileName)
        .forEach(dlId => {
          store.dispatch(removeDownload(dlId));
        });
    });
}

function queryReplace(api: IExtensionApi, destination: string) {
  return api.showDialog('question', 'File exists', {
    text: 'This file already exists, do you want to replace it?',
    message: destination,
  }, [
    { label: 'Cancel' },
    { label: 'Replace' },
  ])
  .then(result => (result.action === 'Cancel')
    ? Promise.reject(new UserCanceled())
    : removeArchive(api.store, destination));
}

function move(api: IExtensionApi, source: string, destination: string): Promise<void> {
  const store = api.store;
  const gameMode = selectors.activeGameId(store.getState());

  const notiId = api.sendNotification({
    type: 'activity',
    title: 'Importing file',
    message: path.basename(destination),
  });
  const dlId = shortid();
  let fileSize: number;
  const fileName = path.basename(destination);
  addLocalInProgress.add(fileName);
  return fs.statAsync(destination)
    .catch(() => undefined)
    .then((stats: fs.Stats) => {
      if (stats !== undefined) {
        fileSize = stats.size;
      }
      return stats !== undefined ? queryReplace(api, destination) : null;
    })
    .then(() => fs.copyAsync(source, destination))
    .then(() => {
      log('debug', 'import local download', destination);
      // do this after copy is completed, otherwise code watching for the event may be
      // trying to access the file already
      store.dispatch(addLocalDownload(dlId, gameMode, fileName, fileSize));
    })
    .then(() => fs.statAsync(destination))
    .then(stats => {
      api.dismissNotification(notiId);
      store.dispatch(downloadProgress(dlId, stats.size, stats.size, [], undefined));
      api.events.emit('did-import-download', [dlId]);
    })
    .catch(err => {
      api.dismissNotification(notiId);
      store.dispatch(removeDownload(dlId));
      log('info', 'failed to copy', {error: err.message});
    })
    .finally(() => {
      addLocalInProgress.delete(fileName);
    });
}

function genImportDownloadsHandler(api: IExtensionApi) {
  return (downloadPaths: string[]) => {
    log('debug', 'importing download(s)', downloadPaths);
    const downloadPath = selectors.downloadPath(api.store.getState());
    let hadDirs = false;
    Promise.map(downloadPaths, dlPath => {
      const fileName = path.basename(dlPath);
      const destination = path.join(downloadPath, fileName);
      return fs.statAsync(dlPath)
        .then(stats => {
          if (stats.isDirectory()) {
            hadDirs = true;
            return Promise.resolve();
          } else {
            return move(api, dlPath, destination);
          }
        })
        .then(() => {
          if (hadDirs) {
            api.sendNotification({
              type: 'warning',
              title: 'Can\'t import directories',
              message:
                'You can drag mod archives here, directories are not supported',
            });
          }
          log('info', 'imported archives', { count: downloadPaths.length });
        })
        .catch(err => {
          api.sendNotification({
            type: 'warning',
            title: err.code === 'ENOENT' ? 'File doesn\'t exist' : err.message,
            message: dlPath,
          });
        });
    });
  };
}

function checkPendingTransfer(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = selectors.activeGameId(state);
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const pendingTransfer: string[] = ['persistent', 'transactions', 'transfer', 'downloads'];
  const transferDestination = getSafe(state, pendingTransfer, undefined);
  if (transferDestination === undefined) {
    return Promise.resolve(result);
  }

  result = {
    severity: 'warning',
    description: {
      short: 'Folder transfer was interrupted',
      long: 'An attempt to move the download folder was interrupted. You should let '
          + 'Vortex clean up now, otherwise you may be left with unnecessary copies of files.',
    },
    automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
      api.sendNotification({
        id: 'transfer-cleanup',
        message: 'Cleaning up interrupted transfer',
        type: 'activity',
      });
      // the transfer works by either copying the files or creating hard links
      // and only deleting the source when everything is transferred successfully,
      // so in case of an interrupted transfer we can always just delete the
      // incomplete target because the source is still there
      return fs.removeAsync(transferDestination)
        .then(() => {
          api.store.dispatch(setTransferDownloads(undefined));
          fixResolve();
        })
        .catch(err => {
          if (err.code === 'ENOENT') {
            // Destination is already gone, that's fine.
            api.store.dispatch(setTransferDownloads(undefined));
            fixResolve();
          } else {
            fixReject();
          }
        })
        .finally(() => {
          api.dismissNotification('transfer-cleanup');
        })
        ;
    }),
  };

  return Promise.resolve(result);
}

function init(context: IExtensionContextExt): boolean {
  const downloadCount = new ReduxProp(context.api, [
    ['persistent', 'downloads', 'files'],
    ], (downloads: { [dlId: string]: IDownload }) => {
      const count = Object.keys(downloads ?? {}).filter(
        id => ['init', 'started', 'paused'].indexOf(downloads[id].state) !== -1).length;
      return count > 0 ? count : undefined;
    });

  context.registerMainPage('download', 'Downloads', DownloadView, {
                             hotkey: 'D',
                             group: 'global',
                             badge: downloadCount,
                           });

  context.registerSettings('Download', Settings, undefined, undefined, 75);

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerReducer(['persistent', 'downloads'], stateReducer);
  context.registerReducer(['persistent', 'transactions'], transactionsReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

  context.registerDownloadProtocol = (schema: string, handler: ProtocolHandler) => {
    protocolHandlers[schema] = handler;
  };

  context.registerAttributeExtractor(100, attributeExtractor);
  context.registerAttributeExtractor(25, attributeExtractorCustom);
  context.registerActionCheck('SET_DOWNLOAD_FILEPATH', (state, action: any) => {
    if (action.payload === '') {
      return 'Attempt to set invalid file name for a download';
    }
    return undefined;
  });

  context.registerTest('verify-downloads-transfers', 'gamemode-activated',
    () => checkPendingTransfer(context.api));

  context.once(() => {
    const DownloadManagerImpl: typeof DownloadManager = require('./DownloadManager').default;
    const observeImpl: typeof observe = require('./DownloadObserver').default;

    const store = context.api.store;

    // undo an earlier bug where vortex registered itself as the default http/https handler
    // (fortunately few applications actually rely on that setting, unfortunately this meant
    // the bug wasn't found for a long time)
    context.api.deregisterProtocol('http');
    context.api.deregisterProtocol('https');

    context.api.registerProtocol('http', false, (url, install) => {
      context.api.events.emit('start-download', [url], {}, undefined,
                              (err: Error, dlId: string) => {
        if (install && (err === null)) {
          context.api.events.emit('start-install-download', dlId);
        }
      });
    });

    context.api.registerProtocol('https', false, (url, install) => {
      context.api.events.emit('start-download', [url], {}, undefined,
                              (err: Error, dlId: string) => {
          if (install && (err === null)) {
            context.api.events.emit('start-install-download', dlId);
          }
        });
    });

    context.api.events.on('will-move-downloads', () => {
      if (currentWatch !== undefined) {
        currentWatch.close();
        currentWatch = undefined;
      }
    });

    context.api.onStateChange(['settings', 'downloads', 'path'], (prev, cur) => {
      updateDebouncer.schedule();
    });

    context.api.onStateChange(['persistent', 'downloads', 'files'],
        (prev: { [dlId: string]: IDownload }, cur: { [dlId: string]: IDownload }) => {
      // when files are added without mod info, query the meta database
      const added = _.difference(Object.keys(cur), Object.keys(prev));
      const filtered = added.filter(
        dlId => (cur[dlId].state === 'finished') && (Object.keys(cur[dlId].modInfo).length === 0));

      const state: IState = context.api.store.getState();

      Promise.map(filtered, dlId => {
        let downloadPath = selectors.downloadPathForGame(state, getDownloadGames(cur[dlId])[0]);
        if (downloadPath === undefined) {
          // Valid situation as the downloads page has been made available to
          //  the users even when no gameMode is active and the user has manually
          //  added a file. In this case, we use the non game specific downloads
          //  path instead.
          downloadPath = selectors.downloadPath(state);
        }
        if (cur[dlId].localPath === undefined) {
          // No point looking up metadata if we don't know the file's name.
          //  https://github.com/Nexus-Mods/Vortex/issues/7362
          log('warn', 'failed to look up mod info', { id: dlId, reason: 'Filename is unknown' });
          return Promise.resolve();
        }
        context.api.lookupModMeta({ filePath: path.join(downloadPath, cur[dlId].localPath) })
          .then(result => {
            if (result.length > 0) {
              const info = result[0].value;
              store.dispatch(setDownloadModInfo(dlId, 'meta', info));
            }
          })
          .catch(err => {
            log('warn', 'failed to look up mod info', err);
          });
      });
    });

    context.api.events.on('gamemode-activated', genGameModeActivated(context.api));

    context.api.events.on('filehash-calculated',
      (filePath: string, fileMD5: string, fileSize: number) => {
        context.api.store.dispatch(setDownloadHashByFile(path.basename(filePath),
                                   fileMD5, fileSize));
      });

    context.api.events.on('enable-download-watch', (enabled: boolean) => {
      watchEnabled = enabled;
    });

    context.api.events.on('refresh-downloads', (gameId: string, callback: (err) => void) => {
      updateDownloadPath(context.api, gameId)
        .then(() => {
          if (callback !== undefined) {
            callback(null);
           }
        })
        .catch(err => {
          if (callback !== undefined) {
            callback(err);
          }
        });
    });

    context.api.events.on('import-downloads', genImportDownloadsHandler(context.api));

    // This debouncer is only needed to avoid a race condition caused primarily by the
    //  testDownloadPath functionality, where the update downloads function gets called twice
    //  in quick succession when the user browses and selects a new downloads folder. This causes,
    //  duplicate archives to get added.
    //   It gets called:
    //  1. Due to change in settings.downloads.path.
    //  2. Due to the gamemode-activated event.
    updateDebouncer = new Debouncer(() => {
      return updateDownloadPath(context.api);
    }, 1000);

    {
      let powerTimer: NodeJS.Timeout;
      let powerBlockerId: number;
      const stopTimer = () => {
        if ((powerBlockerId !== undefined)
            && remote.powerSaveBlocker.isStarted(powerBlockerId)) {
          remote.powerSaveBlocker.stop(powerBlockerId);
        }
        powerBlockerId = undefined;
        powerTimer = undefined;
      };

      const speedsDebouncer = new Debouncer(() => {
        store.dispatch(setDownloadSpeeds(store.getState().persistent.downloads.speedHistory));
        return null;
      }, 10000, false);
      manager = new DownloadManagerImpl(
          selectors.downloadPath(store.getState()),
          store.getState().settings.downloads.maxParallelDownloads,
          store.getState().settings.downloads.maxChunks, (speed: number) => {
            if ((speed !== 0) || (store.getState().persistent.downloads.speed !== 0)) {
              // this first call is only applied in the renderer for performance reasons
              store.dispatch(setDownloadSpeed(speed));
              // this schedules the main progress to be updated
              speedsDebouncer.schedule();
              if (powerTimer !== undefined) {
                clearTimeout(powerTimer);
              }
              if (powerBlockerId === undefined) {
                powerBlockerId = remote.powerSaveBlocker.start('prevent-app-suspension');
              }
              powerTimer = setTimeout(stopTimer, 60000);
            }
          }, `Nexus Client v2.${app.getVersion()}`, protocolHandlers);
      manager.setFileExistsCB(fileName => {
        return context.api.showDialog('question', 'File already exists', {
          text: 'You\'ve already downloaded the file "{{fileName}}", do you want to '
              + 'download it again?',
          parameters: {
            fileName,
          },
        }, [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => result.action === 'Continue');
      });
      observer =
          observeImpl(context.api, manager);

      const downloads = (store.getState() as IState).persistent.downloads.files;
      const interruptedDownloads = Object.keys(downloads)
        .filter(id => ['init', 'started', 'pending'].indexOf(downloads[id].state) !== -1);
      interruptedDownloads.forEach(id => {
        if (!truthy(downloads[id].urls)) {
          // download was interrupted before receiving urls, has to be canceled
          log('info', 'download removed because urls were never retrieved', { id });
          const downloadPath = selectors.downloadPath(context.api.store.getState());
          if ((downloadPath !== undefined) && (downloads[id].localPath !== undefined)) {
            fs.removeAsync(path.join(downloadPath, downloads[id].localPath))
              .then(() => {
                store.dispatch(removeDownload(id));
              });
          } else {
            store.dispatch(removeDownload(id));
          }
        } else {
          let realSize = (downloads[id].size !== 0)
            ? downloads[id].size - sum((downloads[id].chunks || []).map(chunk => chunk.size))
            : 0;
          if (isNaN(realSize)) {
            realSize = 0;
          }
          store.dispatch(setDownloadInterrupted(id, realSize));
        }
      });
      // remove downloads that have no localPath set because they just cause trouble. They shouldn't
      // exist at all
      Object.keys(downloads)
        .filter(dlId => !truthy(downloads[dlId].localPath))
        .forEach(dlId => {
          store.dispatch(removeDownload(dlId));
        });
    }
  });

  return true;
}

export default init;
