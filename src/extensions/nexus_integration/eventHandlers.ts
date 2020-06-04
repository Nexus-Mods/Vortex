import { setDownloadModInfo } from '../../actions';
import { IDownload, IModTable, IState, StateChangeCallback } from '../../types/api';
import { IExtensionApi } from '../../types/IExtensionContext';
import { ArgumentInvalid, DataInvalid, ProcessCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import opn from '../../util/opn';
import { activeGameId, gameById } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { toPromise } from '../../util/util';

import { DownloadIsHTML } from '../download_management/DownloadManager';
import { SITE_ID } from '../gamemode_management/constants';
import {IGameStored} from '../gamemode_management/types/IGameStored';
import { setUpdatingMods } from '../mod_management/actions/session';

import { setUserInfo } from './actions/persistent';
import { findLatestUpdate, retrieveModInfo } from './util/checkModsVersion';
import { nexusGameId, toNXMId } from './util/convertGameId';
import { FULL_COLLECTION_INFO, FULL_REVISION_INFO } from './util/graphQueries';
import submitFeedback from './util/submitFeedback';

import { checkModVersionsImpl, endorseModImpl, startDownload, updateKey } from './util';

import * as Promise from 'bluebird';
import Nexus, { ICollection, IFeedbackResponse, IIssue, IRevision,
                NexusError, RateLimitError, TimeoutError } from 'nexus-api';
import * as semver from 'semver';

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
            gameId = Array.isArray(download.game)
              ? download.game[0]
              : activeGameId(api.store.getState());
          }
          const gameDomain = nexusGameId(gameById(state, gameId), gameId);
          if ((modId !== undefined)
            && ((oldModId !== modId) || (oldFileId !== fileId))) {
            return nexus.getModInfo(modId, gameDomain)
              .then(modInfo => {
                api.store.dispatch(setDownloadModInfo(dlId, 'nexus.modInfo', modInfo));
                return (fileId !== undefined)
                  ? nexus.getFileInfo(modId, fileId, gameDomain)
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

function getFileId(download: IDownload): number {
  const res = getSafe(download, ['modInfo', 'nexus', 'ids', 'fileId'], undefined);

  if ((res === undefined)
      && (getSafe(download, ['modInfo', 'source'], undefined) === 'nexus')) {
    return getSafe(download, ['modInfo', 'ids', 'fileId'], undefined);
  } else {
    return res;
  }
}

function downloadFile(api: IExtensionApi, nexus: Nexus,
                      game: IGameStored, modId: number, fileId: number): Promise<string> {
    const state: IState = api.store.getState();
    const gameId = game !== null ? game.id : SITE_ID;
    if ((game !== null)
        && !getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false)) {
      // nexusmods can't let users download files directly from client, without
      // showing ads
      return Promise.reject(new ProcessCanceled('Only available to premium users'));
    }
    // TODO: Need some way to identify if this request is actually for a nexus mod
    const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;

    const downloads = state.persistent.downloads.files;
    // check if the file is already downloaded. If not, download before starting the install
    const existingId = Object.keys(downloads).find(downloadId =>
      downloads[downloadId].game.includes(gameId)
      && (getFileId(downloads[downloadId]) === fileId));
    if (existingId !== undefined) {
      return Promise.resolve(existingId);
    } else {
      // startDownload will report network errors and only reject on usage error
      return startDownload(api, nexus, url);
    }
}

export function onModUpdate(api: IExtensionApi, nexus: Nexus): (...args: any[]) => void {
  return (gameId, modId, fileId) => {
    const game = gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);

    downloadFile(api, nexus, game, modId, fileId)
      .then(downloadId => {
        api.events.emit('start-install-download', downloadId);
      })
      .catch(DownloadIsHTML, err => undefined)
      .catch(DataInvalid, () => {
        const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
        api.showErrorNotification('Invalid URL', url, { allowReport: false });
      })
      .catch(ProcessCanceled, () =>
        opn(['https://www.nexusmods.com', nexusGameId(game), 'mods', modId].join('/'))
          .catch(() => undefined))
      .catch(err => {
        api.showErrorNotification('failed to start download', err);
      });
  };
}

export function onNexusDownload(api: IExtensionApi,
                                nexus: Nexus)
                                : (...args: any[]) => Promise<any> {
  return (gameId, modId, fileId): Promise<string> => {
    const game = gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);
    const APIKEY = getSafe(api.store.getState(),
                           ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (APIKEY === '') {
      api.showErrorNotification('Failed to start download',
                                'You are not logged in to Nexus Mods!',
                                { allowReport: false });
      return Promise.resolve(undefined);
    } else {
      return downloadFile(api, nexus, game, modId, fileId)
        .catch(ProcessCanceled, err => {
          api.sendNotification({
            type: 'error',
            message: err.message,
          });
        })
        .catch(err => {
          api.showErrorNotification('Nexus download failed', err);
          return Promise.resolve(undefined);
        });
    }
  };
}

export function onGetNexusCollection(api: IExtensionApi, nexus: Nexus)
    : (collectionId: number) => Promise<ICollection> {
  return (collectionId: number): Promise<ICollection> => {
    return Promise.resolve(nexus.getCollectionGraph(FULL_COLLECTION_INFO, collectionId))
      .catch(err => {
        api.showErrorNotification('Failed to get collection info', err);
        return Promise.resolve(undefined);
      });
  };
}

export function onGetNexusCollections(api: IExtensionApi, nexus: Nexus)
    : (gameId: string) => Promise<ICollection[]> {
  return (gameId: string): Promise<ICollection[]> =>
    Promise.resolve(nexus.getCollectionsByGame(gameId))
      .catch(err => {
        api.showErrorNotification('Failed to get list of collections', err);
        return Promise.resolve(undefined);
      });
}

export function onGetNexusRevision(api: IExtensionApi, nexus: Nexus)
    : (collectionId: number, revisionId: number) => Promise<IRevision> {
  return (collectionId: number, revisionId: number): Promise<IRevision> =>
    Promise.resolve(nexus.getRevisionGraph(FULL_REVISION_INFO, revisionId))
      .catch(err => {
        api.showErrorNotification('Failed to get nexus revision info', err);
        return Promise.resolve(undefined);
      });
}

export function onRateRevision(api: IExtensionApi, nexus: Nexus)
    : (revisionId: number, rating: number) => Promise<boolean> {
  return (revisionId: number, rating: number): Promise<boolean> => {
    return Promise.resolve(nexus.rateRevision(revisionId, rating))
      .then(() => true)
      .catch(err => {
        api.showErrorNotification('Failed to rate collection', err);
        return Promise.resolve(false);
      });
  };
}

export function onDownloadUpdate(api: IExtensionApi,
                                 nexus: Nexus)
                                 : (...args: any[]) => Promise<string> {
  return (source: string, gameId: string, modId: string,
          fileId: string, versionPattern: string): Promise<string> => {
    if (source !== 'nexus') {
      return Promise.resolve(undefined);
    }

    const game = gameById(api.store.getState(), gameId);

    if (game === undefined) {
      return Promise.reject(new ArgumentInvalid(gameId));
    }

    const fileIdNum = parseInt(fileId, 10);

    return Promise.resolve(nexus.getModFiles(parseInt(modId, 10), nexusGameId(game) || gameId))
      .then(files => {
        let updateFileId: number;

        const updateChain = findLatestUpdate(files.file_updates, [], fileIdNum);
        const newestMatching = updateChain
          // sort newest to oldest
          .sort((lhs, rhs) => rhs.uploaded_timestamp - lhs.uploaded_timestamp)
          // find the first update entry that has a version matching the pattern
          .find(update => {
            const file = files.files.find(iter => iter.file_id === update.new_file_id);
            return (versionPattern === '*')
                || semver.satisfies(semver.coerce(file.version), versionPattern);
          });

        if (newestMatching !== undefined) {
          updateFileId = newestMatching.new_file_id;
        } else {
          // no update chain, maybe we're lucky and there is only a single file not marked
          // as old
          const notOld = files.files
            .filter(file => (file.category_id !== 4) && (file.category_id !== 6));
          if ((notOld.length === 1)
              && (semver.satisfies(semver.coerce(notOld[0].version), versionPattern))) {
            updateFileId = notOld[0].file_id;
          }
        }

        if (updateFileId === undefined) {
          updateFileId = fileIdNum;
        }

        const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${updateFileId}`;
        const state: IState = api.store.getState();
        const downloads = state.persistent.downloads.files;
        // check if the file is already downloaded. If not, download before starting the install
        const existingId = Object.keys(downloads).find(downloadId => {
          return (getFileId(downloads[downloadId]) === fileIdNum)
              && downloads[downloadId].state !== 'failed';
        });

        if (existingId !== undefined) {
          if (downloads[existingId].state === 'paused') {
            return toPromise(cb => api.events.emit('resume-download', existingId, cb))
              .then(() => existingId);
          } else {
            return Promise.resolve(existingId);
          }
        }

        return startDownload(api, nexus, url)
          .catch(err => {
            api.showErrorNotification('Failed to download mod', err, {
              allowReport: false,
            });
            return Promise.resolve(undefined);
          });
      })
      .catch(err => {
        // there is a really good chance that the download will fail
        log('warn', 'failed to fetch mod file list', err.message);
        const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
        return startDownload(api, nexus, url);
      });
  };
}

export function onSubmitFeedback(nexus: Nexus): (...args: any[]) => void {
  return (title: string, message: string, hash: string, feedbackFiles: string[],
          anonymous: boolean, callback: (err: Error, response?: IFeedbackResponse) => void) => {
    submitFeedback(nexus, title, message, feedbackFiles, anonymous, hash)
      .then(response => callback(null, response))
      .catch(err => callback(err));
  };
}

function sendCollection(nexus: Nexus, collectionInfo: any, collectionId: number, data: Buffer) {
  if (collectionId === undefined) {
    return nexus.createCollection({
        adultContent: false,
        collectionManifest: collectionInfo,
        assetFile: data.toString('base64'),
        collectionSchemaId: 1,
      });
  } else {
    return nexus.updateCollection({
        adultContent: false,
        collectionManifest: collectionInfo,
        assetFile: data.toString('base64'),
        collectionSchemaId: 1,
    }, collectionId);
  }
}

export function onSubmitCollection(nexus: Nexus): (...args: any[]) => void {
  return (collectionInfo: any,
          assetFilePath: string,
          collectionId: number,
          callback: (err: Error, response?: any) => void) => {
    fs.readFileAsync(assetFilePath)
      .then((data: Buffer) => sendCollection(nexus, collectionInfo, collectionId, data))
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
  return (gameId, mods, forceFull) => {
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
      return checkModVersionsImpl(api.store, nexus, gameId, mods, forceFull)
        .then((errorMessages: string[]) => {
          if (errorMessages.length !== 0) {
            showError(api.store.dispatch,
                      'Some mods could not be checked for updates',
                      errorMessages.join('[br][/br]'),
                      { allowReport: false, isBBCode: true });
          }
        })
        .catch(NexusError, err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err, {
            allowReport: false,
          });
        })
        .catch(TimeoutError, err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err, {
            allowReport: false,
          });
        })
        .catch(RateLimitError, err => {
          showError(api.store.dispatch, 'Rate limit exceeded, please try again later', err, {
            allowReport: false,
          });
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
