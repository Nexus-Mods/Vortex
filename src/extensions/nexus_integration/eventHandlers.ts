import { setDownloadModInfo } from '../../actions';
import { IDownload, IModTable, IState, StateChangeCallback } from '../../types/api';
import { IExtensionApi } from '../../types/IExtensionContext';
import { DataInvalid } from '../../util/api';
import Debouncer from '../../util/Debouncer';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import opn from '../../util/opn';
import { activeGameId, gameById } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { DownloadIsHTML } from '../download_management/DownloadManager';
import { setUpdatingMods } from '../mod_management/actions/session';

import { setUserInfo } from './actions/persistent';
import { retrieveModInfo } from './util/checkModsVersion';
import { nexusGameId, toNXMId } from './util/convertGameId';
import submitFeedback from './util/submitFeedback';

import { checkModVersionsImpl, endorseModImpl, startDownload, updateKey } from './util';

import * as Promise from 'bluebird';
import Nexus, { IFeedbackResponse, IIssue } from 'nexus-api';

export function onChangeDownloads(api: IExtensionApi, nexus: Nexus) {
  const state: IState = api.store.getState();
  // contains the state from before the debouncer last triggered
  let lastDownloadTable = state.persistent.downloads.files;

  const updateDebouncer: Debouncer = new Debouncer(
    (newDownloadTable: { [id: string]: IDownload }) => {
      if (lastDownloadTable !== newDownloadTable) {
        const idsPath = ['modInfo', 'nexus', 'ids'];
        return Promise.map(Object.keys(newDownloadTable), dlId => {
          const download = newDownloadTable[dlId];
          const oldModId = getSafe(lastDownloadTable, [dlId, ...idsPath, 'modId'], undefined);
          const oldFileId = getSafe(lastDownloadTable, [dlId, ...idsPath, 'fileId'], undefined);
          const modId = getSafe(download, [...idsPath, 'modId'], undefined);
          const fileId = getSafe(download, [...idsPath, 'fileId'], undefined);
          let gameId = getSafe(download, [...idsPath, 'gameId'], undefined);
          if (gameId === undefined) {
            if (Array.isArray(download.game)) {
              gameId = download.game[0];
            } else {
              gameId = activeGameId(api.store.getState());
            }
          }
          if ((modId !== undefined)
            && ((oldModId !== modId) || (oldFileId !== fileId))) {
            return nexus.getModInfo(modId, gameId)
              .then(modInfo => {
                api.store.dispatch(setDownloadModInfo(dlId, 'nexus.modInfo', modInfo));
                return (fileId !== undefined)
                  ? nexus.getFileInfo(modId, fileId, gameId)
                    .catch(err => {
                      log('warn', 'failed to query file info', { message: err.message });
                      return Promise.resolve(undefined);
                    })
                  : Promise.resolve(undefined);
              })
              .then(fileInfo => {
                api.store.dispatch(setDownloadModInfo(dlId, 'nexus.fileInfo', fileInfo));
              })
              .catch(err => {
                log('warn', 'failed to query mod info', { message: err.message });
              });
          } else {
            return Promise.resolve();
          }
        })
          .then(() => {
            lastDownloadTable = newDownloadTable;
          });
      }
      return null;
    }, 2000);

  return (oldValue: IModTable, newValue: IModTable) =>
      updateDebouncer.schedule(undefined, newValue);
}

/**
 * callback for when mods are changed
 *
 * @export
 * @param {IExtensionApi} api
 * @param {Nexus} nexus
 * @returns
 */
export function onChangeMods(api: IExtensionApi, nexus: Nexus) {
  // the state from before the debouncer last triggered
  let lastModTable = api.store.getState().persistent.mods;

  const updateDebouncer: Debouncer = new Debouncer(
      (newModTable: IModTable) => {
    if ((lastModTable === undefined) || (newModTable === undefined)) {
      return;
    }
    const state = api.store.getState();
    const gameMode = activeGameId(state);
    // ensure anything changed for the actiave game
    if ((lastModTable[gameMode] !== newModTable[gameMode])
        && (lastModTable[gameMode] !== undefined)
        && (newModTable[gameMode] !== undefined)) {
      // for any mod where modid or download section have been changed,
      // retrieve the new mod info
      return Promise.map(Object.keys(newModTable[gameMode]), modId => {
        const modSource =
          getSafe(newModTable, [gameMode, modId, 'attributes', 'source'], undefined);
        if (modSource !== 'nexus') {
          return Promise.resolve();
        }

        const idPath = [gameMode, modId, 'attributes', 'modId'];
        const dlGamePath = [gameMode, modId, 'attributes', 'downloadGame'];
        if ((getSafe(lastModTable, idPath, undefined)
              !== getSafe(newModTable, idPath, undefined))
            || (getSafe(lastModTable, dlGamePath, undefined)
              !== getSafe(newModTable, dlGamePath, undefined))) {
          return retrieveModInfo(nexus, api,
            gameMode, newModTable[gameMode][modId], api.translate)
            .then(() => {
              lastModTable = newModTable;
            });
        } else {
          return Promise.resolve();
        }
      }).then(() => null);
    } else {
      return Promise.resolve();
    }
  }, 2000);

  // we can't pass oldValue to the debouncer because that would only include the state
  // for the last time the debouncer is triggered, missing all other updates
  return (oldValue: IModTable, newValue: IModTable) =>
      updateDebouncer.schedule(undefined, newValue);
}

export function onOpenModPage(api: IExtensionApi) {
  return (gameId: string, modId: string) => {
    const game = gameById(api.store.getState(), gameId);
    opn(['https://www.nexusmods.com',
      nexusGameId(game) || gameId, 'mods', modId,
    ].join('/')).catch(err => undefined);
  };
}

export function onChangeNXMAssociation(registerFunc: (def: boolean) => void,
                                       api: IExtensionApi): StateChangeCallback {
  return (oldValue: boolean, newValue: boolean) => {
    log('info', 'associate', { oldValue, newValue });
    if (newValue === true) {
      registerFunc(true);
    } else {
      api.deregisterProtocol('nxm');
    }
  };
}

export function onRequestOwnIssues(nexus: Nexus) {
  return (cb: (err: Error, issues?: IIssue[]) => void) => {
    nexus.getOwnIssues()
      .then(issues => {
        cb(null, issues);
      })
      .catch(err => cb(err));
  };
}

export function onModUpdate(api: IExtensionApi, nexus: Nexus): (...args: any[]) => void {
  return (gameId, modId, fileId) => {
    const state: IState = api.store.getState();
    const game = gameById(api.store.getState(), gameId);
    if (!getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false)) {
      // nexusmods can't let users download files directly from client, without
      // showing ads
      opn(['https://www.nexusmods.com', nexusGameId(game), 'mods', modId].join('/'))
        .catch(() => undefined);
      return;
    }
    // TODO: Need some way to identify if this request is actually for a nexus mod
    const url = `nxm://${toNXMId(game)}/mods/${modId}/files/${fileId}`;
    const downloads = state.persistent.downloads.files;
    // check if the file is already downloaded. If not, download before starting the install
    const existingId = Object.keys(downloads).find(downloadId =>
      getSafe(downloads, [downloadId, 'modInfo', 'nexus', 'ids', 'fileId'], undefined) === fileId);
    if (existingId !== undefined) {
      api.events.emit('start-install-download', existingId);
    } else {
      startDownload(api, nexus, url)
        .then(downloadId => {
          if (downloadId !== undefined) {
            api.events.emit('start-install-download', downloadId);
          } else {
            api.showErrorNotification(
              'Failed to download update file, please download it manually.',
              undefined, { allowReport: false });
          }
        })
        .catch(DownloadIsHTML, err => undefined)
        .catch(DataInvalid, () => {
          api.showErrorNotification('Invalid URL', url, { allowReport: false });
        })
        .catch(err => {
          api.showErrorNotification('failed to start download', err);
        });
    }
  };
}

export function onSubmitFeedback(nexus: Nexus): (...args: any[]) => void {
  return (title: string, message: string, hash: string, feedbackFiles: string[],
          anonymous: boolean, callback: (err: Error, respones?: IFeedbackResponse) => void) => {
    submitFeedback(nexus, title, message, feedbackFiles, anonymous, hash)
      .then(response => callback(null, response))
      .catch(err => callback(err));
  };
}

export function onEndorseMod(api: IExtensionApi, nexus: Nexus): (...args: any[]) => void {
  return (gameId, modId, endorsedStatus) => {
    const APIKEY = getSafe(api.store.getState(),
                           ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (APIKEY === '') {
      api.showErrorNotification('An error occurred endorsing a mod',
                                'You are not logged in to Nexus Mods!',
                                { allowReport: false });
    } else {
      endorseModImpl(api, nexus, gameId, modId, endorsedStatus);
    }
  };
}

export function onAPIKeyChanged(api: IExtensionApi, nexus: Nexus): StateChangeCallback {
  return (oldValue: string, newValue: string) => {
    api.store.dispatch(setUserInfo(undefined));
    if (newValue !== undefined) {
      updateKey(api, nexus, newValue);
    }
  };
}

export function onCheckModsVersion(api: IExtensionApi,
                                   nexus: Nexus): (...args: any[]) => Promise<void> {
  return (gameId, mods) => {
    const APIKEY = getSafe(api.store.getState(),
                           ['confidential', 'account', 'nexus', 'APIKey'],
                           '');
    if (APIKEY === '') {
      api.showErrorNotification('An error occurred checking for mod updates',
                                'You are not logged in to Nexus Mods!',
                                { allowReport: false });
      return Promise.resolve();
    } else {
      api.store.dispatch(setUpdatingMods(gameId, true));
      const start = Date.now();
      return checkModVersionsImpl(api.store, nexus, gameId, mods)
        .then((errorMessages: string[]) => {
          if (errorMessages.length !== 0) {
            showError(api.store.dispatch,
                      'Some mods could not be checked for updates',
                      errorMessages.join('\n\n'),
                      { allowReport: false, isBBCode: true });
          }
        })
        .catch(err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err);
        })
        .then(() => Promise.delay(2000 - (Date.now() - start)))
        .finally(() => {
          api.store.dispatch(setUpdatingMods(gameId, false));
        });
    }
  };
}
