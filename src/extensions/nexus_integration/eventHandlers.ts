import { setDownloadModInfo } from '../../actions';
import { IExtensionApi, StateChangeCallback } from '../../types/IExtensionContext';
import { IDownload, IModTable, IState } from '../../types/IState';
import { ArgumentInvalid, DataInvalid, ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { upload } from '../../util/network';
import opn from '../../util/opn';
import { activeGameId, currentGame, downloadPathForGame, gameById } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { toPromise } from '../../util/util';

import { AlreadyDownloaded, DownloadIsHTML } from '../download_management/DownloadManager';
import { SITE_ID } from '../gamemode_management/constants';
import {IGameStored} from '../gamemode_management/types/IGameStored';
import { setUpdatingMods } from '../mod_management/actions/session';

import { setUserInfo } from './actions/persistent';
import { findLatestUpdate, retrieveModInfo } from './util/checkModsVersion';
import { nexusGameId, toNXMId } from './util/convertGameId';
import { FULL_COLLECTION_INFO, FULL_REVISION_INFO } from './util/graphQueries';
import submitFeedback from './util/submitFeedback';

import { NEXUS_BASE_URL, NEXUS_NEXT_URL } from './constants';
import { checkModVersionsImpl, endorseDirectImpl, endorseThing, startDownload, updateKey } from './util';

import Nexus, { EndorsedStatus, ICollection, ICollectionManifest,
                IDownloadURL, IFeedbackResponse,
                IIssue, IRevision, NexusError, RateLimitError, TimeoutError } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import * as path from 'path';
import * as semver from 'semver';
import { format as urlFormat } from 'url';

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
    // TODO: this triggers only for the current game but "swallows" all changes
    //   for all games, meaning that if we change the nexus id for a mod of a
    //   different game, it will never be re-fetched
    // ensure anything changed for the active game
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
      lastModTable = newModTable;
      return Promise.resolve();
    }
  }, 2000);

  // we can't pass oldValue to the debouncer because that would only include the state
  // for the last time the debouncer is triggered, missing all other updates
  return (oldValue: IModTable, newValue: IModTable) =>
      updateDebouncer.schedule(undefined, newValue);
}

export function onOpenCollectionPage(api: IExtensionApi) {
  return (gameId: string, collectionSlug: string, source: string) => {
    if (source !== 'nexus') {
      return;
    }
    const game = gameById(api.store.getState(), gameId);
    opn([NEXUS_NEXT_URL,
      nexusGameId(game) || gameId, 'collections', collectionSlug,
    ].join('/')).catch(err => undefined);
  };
}

export function onOpenModPage(api: IExtensionApi) {
  return (gameId: string, modId: string, source: string) => {
    if (source !== 'nexus') {
      return;
    }
    const game = gameById(api.store.getState(), gameId);
    opn([NEXUS_BASE_URL,
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
                      game: IGameStored, modId: number, fileId: number,
                      fileName?: string,
                      allowInstall?: boolean): Promise<string> {
    const state: IState = api.getState();
    const gameId = game !== null ? game.id : SITE_ID;
    if ((game !== null)
        && !getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false)) {
      // nexusmods can't let users download files directly from client, without
      // showing ads
      return Promise.reject(new ProcessCanceled('Only available to premium users'));
    }
    // TODO: Need some way to identify if this request is actually for a nexus mod
    const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
    log('debug', 'downloading from generated nxm link', { url, fileName });

    const downloads = state.persistent.downloads.files;
    // check if the file is already downloaded. If not, download before starting the install
    const existingId = Object.keys(downloads).find(downloadId =>
      (downloads[downloadId]?.game || []).includes(gameId)
      && (downloads[downloadId]?.modInfo?.nexus?.ids?.modId === modId)
      && (downloads[downloadId]?.modInfo?.nexus?.ids?.fileId === fileId));
    if ((existingId !== undefined)
        && (downloads[existingId]?.localPath !== undefined)
        && (downloads[existingId]?.state !== 'failed')) {
      log('debug', 'found an existing matching download',
        { id: existingId, data: JSON.stringify(downloads[existingId]) });
      const downloadPath = downloadPathForGame(state, gameId);
      return fs.statAsync(path.join(downloadPath, downloads[existingId].localPath))
        .then(() => Promise.resolve(existingId))
        .catch((err) => (err.code === 'ENOENT')
          ? startDownload(api, nexus, url,
                          fileName !== undefined ? 'replace' : 'never',
                          fileName, allowInstall)
          : Promise.reject(err));
    } else {
      // startDownload will report network errors and only reject on usage error
      return startDownload(api, nexus, url,
                           fileName !== undefined ? 'replace' : 'never',
                           fileName, allowInstall);
    }
}

export function onModUpdate(api: IExtensionApi, nexus: Nexus): (...args: any[]) => void {
  return (gameId: string, modId, fileId, source: string) => {
    let game = gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);

    if (game === undefined) {
      log('warn', 'mod update requested for unknown game id', gameId);
      game = currentGame(api.getState());
    }

    if (source !== 'nexus') {
      // not a mod from nexus mods
      return;
    }

    downloadFile(api, nexus, game, modId, fileId, undefined, false)
      .catch(AlreadyDownloaded, err => {
        const state = api.getState();
        const downloads = state.persistent.downloads.files;
        const dlId = Object.keys(downloads).find(iter =>
          downloads[iter].localPath === err.fileName);
        return dlId;
      })
      .then(downloadId => {
        api.events.emit('start-install-download', downloadId);
      })
      .catch(DownloadIsHTML, err => undefined)
      .catch(DataInvalid, () => {
        const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
        api.showErrorNotification('Invalid URL', url, { allowReport: false });
      })
      .catch(ProcessCanceled, () => {
        const url = [NEXUS_BASE_URL, nexusGameId(game), 'mods', modId].join('/');
        const params = `?tab=files&file_id=${fileId}&nmm=1`;
        return opn(url + params)
          .catch(() => undefined);
      })
      .catch(err => {
        api.showErrorNotification('Failed to start download', err);
      });
  };
}

export function onNexusDownload(api: IExtensionApi,
                                nexus: Nexus)
                                : (...args: any[]) => Promise<any> {
  return (gameId: string, modId: number, fileId: number,
          fileName?: string, allowInstall?: boolean): Promise<string> => {
    const game = gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);
    const APIKEY = getSafe(api.store.getState(),
                           ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (APIKEY === '') {
      api.showErrorNotification('Failed to start download',
                                'You are not logged in to Nexus Mods!',
                                { allowReport: false });
      return Promise.resolve(undefined);
    } else {
      log('debug', 'on nexus download', fileName);
      return downloadFile(api, nexus, game, modId, fileId, fileName, allowInstall)
        .catch(ProcessCanceled, err => {
          api.sendNotification({
            type: 'error',
            message: err.message,
          });
        })
        .catch(AlreadyDownloaded, err => {
          const { files } = api.getState().persistent.downloads;
          const dlId = Object.keys(files).find(iter => files[iter].localPath === err.fileName);
          return Promise.resolve(dlId);
        })
        .catch(err => {
          api.showErrorNotification('Nexus download failed', err);
          return Promise.resolve(undefined);
        });
    }
  };
}

export function onGetNexusCollection(api: IExtensionApi, nexus: Nexus)
    : (collectionId: number, slug: string) => Promise<ICollection> {
  return (collectionId: number, slug: string): Promise<ICollection> => {
    if ((slug === undefined) && !Number.isFinite(collectionId)) {
      return Promise.reject(new Error('invalid parameter, collectionId has to be a number'));
    }

    return Promise.resolve((slug !== undefined)
        ? (nexus as any).getCollectionGraph(FULL_COLLECTION_INFO, slug)
        : (nexus as any).getCollectionGraphLegacy(FULL_COLLECTION_INFO, collectionId))
      .catch(err => {
        if (err.code !== 'NOT_FOUND') {
          api.showErrorNotification('Failed to get collection info', err);
        }
        return Promise.resolve(undefined);
      });
  };
}

export function onGetNexusCollections(api: IExtensionApi, nexus: Nexus)
    : (gameId: string) => Promise<ICollection[]> {
  return (gameId: string): Promise<ICollection[]> =>
    Promise.resolve(nexus.getCollectionListGraph(FULL_COLLECTION_INFO, gameId))
      .catch(err => {
        api.showErrorNotification('Failed to get list of collections', err);
        return Promise.resolve(undefined);
      });
}

export function onResolveCollectionUrl(api: IExtensionApi, nexus: Nexus)
  : (apiLink: string) => Promise<IDownloadURL[]> {
  return (apiLink: string): Promise<IDownloadURL[]> =>
    Promise.resolve(nexus.getCollectionDownloadLink(apiLink))
      .catch(err => {
        api.showErrorNotification('Failed to get list of collections', err);
        return Promise.resolve([]);
      });
}

export function onGetNexusRevision(api: IExtensionApi, nexus: Nexus)
    : (revisionId: number) => Promise<IRevision> {
  return (revisionId: number): Promise<IRevision> => {
    if (!Number.isFinite(revisionId)) {
      return Promise.reject(
        new Error('invalid parameter, revisionId has to be a number, '
                  + `got: ${revisionId}`));
    }
    return Promise.resolve(nexus.getRevisionGraph(FULL_REVISION_INFO, revisionId))
      .catch(err => {
        if (err.code !== 'NOT_FOUND') {
          api.showErrorNotification('Failed to get nexus revision info', err);
        }
        return Promise.resolve(undefined);
      });
  };
}

export function onGetNexusCollectionRevision(api: IExtensionApi, nexus: Nexus)
    : (collectionSlug: string, revisionNumber: number) => Promise<IRevision> {
  return (collectionSlug: string, revisionNumber: number): Promise<IRevision> => {
    if (!Number.isFinite(revisionNumber)) {
      return Promise.reject(
        new Error('invalid parameter, revisionNumber has to be a number, '
                  + `got: ${revisionNumber}`));
    }
    return Promise.resolve(nexus.getCollectionRevisionGraph(FULL_REVISION_INFO,
                                                            collectionSlug, revisionNumber))
      .catch(err => {
        if (err.code !== 'NOT_FOUND') {
          api.showErrorNotification('Failed to get nexus revision info', err);
        }
        return Promise.resolve(undefined);
      });
  };
}

export function onRateRevision(api: IExtensionApi, nexus: Nexus)
    : (revisionId: number, rating: number) => Promise<boolean> {
  return (revisionId: number, rating: any): Promise<boolean> => {
    return Promise.resolve(nexus.rateRevision(revisionId, rating))
      .catch(err => {
        api.showErrorNotification('Failed to rate collection', err);
        return Promise.resolve(false);
      });
  };
}

interface IDownloadResult {
  error: Error;
  dlId?: string;
}

export function onDownloadUpdate(api: IExtensionApi,
                                 nexus: Nexus)
                                 : (...args: any[]) => Promise<IDownloadResult> {
  return (source: string, gameId: string, modId: string,
          fileId: string, versionPattern: string,
          campaign: string): Promise<IDownloadResult> => {
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
            if (file === undefined) {
              return false;
            }
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

        const urlParsed = new URL(`nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${updateFileId}`);
        if (campaign !== undefined) {
          urlParsed.searchParams.set('campaign', campaign);
        }
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
              .then(() => ({ error: null, dlId: existingId }));
          } else {
            return Promise.resolve({ error: null, dlId: existingId });
          }
        }

        return startDownload(api, nexus, urlFormat(urlParsed), 'never', undefined, false, false)
          .then(dlId => ({ error: null, dlId }))
          .catch(err => {
            return { error: err };
          });
      })
      .catch(err => {
        if (err instanceof UserCanceled) {
          // there is a really good chance that the download will fail
          log('warn', 'failed to fetch mod file list', err.message);
          const urlParsed = new URL(`nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`);
          if (campaign !== undefined) {
            urlParsed.searchParams.set('campaign', campaign);
          }
          return startDownload(api, nexus, urlFormat(urlParsed), 'never', undefined, false, false)
            .then(dlId => ({ error: null, dlId }))
            .catch(innerErr => ({ error: innerErr }));
        } else {
          return Promise.resolve({ error: err });
        }
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

function sendCollection(nexus: Nexus,
                        collectionInfo: ICollectionManifest,
                        collectionId: number,
                        uuid: string) {
  if (collectionId === undefined) {
    return nexus.createCollection({
        adultContent: false,
        collectionManifest: collectionInfo,
        collectionSchemaId: 1,
      }, uuid);
  } else {
    return nexus.editCollection(collectionId as any, collectionInfo.info.name)
      .then(() => nexus.createOrUpdateRevision({
        adultContent: false,
        collectionManifest: collectionInfo,
        collectionSchemaId: 1,
      }, uuid, collectionId));
  }
}

export function onSubmitCollection(nexus: Nexus): (...args: any[]) => void {
  return (collectionInfo: ICollectionManifest,
          assetFilePath: string,
          collectionId: number,
          callback: (err: Error, response?: any) => void) => {
    nexus.getRevisionUploadUrl()
    .then(({ url, uuid }) => {
      return fs.statAsync(assetFilePath)
        .then(stat => upload(url, fs.createReadStream(assetFilePath), stat.size))
        .then(() => uuid);
    })
    .then((uuid: string) => sendCollection(nexus, collectionInfo, collectionId, uuid))
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
      endorseThing(api, nexus, gameId, modId, endorsedStatus);
    }
  };
}

export function onEndorseDirect(api: IExtensionApi, nexus: Nexus) {
  return (gameId: string, nexusId: number, version: string,
          endorsedStatus: EndorsedStatus): Promise<EndorsedStatus> => {
    return endorseDirectImpl(api, nexus, gameId, nexusId, version, endorsedStatus)
      .then(res => res as EndorsedStatus);
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
                                   nexus: Nexus): (...args: any[]) => Promise<string[]> {
  return (gameId, mods, forceFull) => {
    const APIKEY = getSafe(api.store.getState(),
                           ['confidential', 'account', 'nexus', 'APIKey'],
                           '');
    if (APIKEY === '') {
      api.showErrorNotification('An error occurred checking for mod updates',
                                'You are not logged in to Nexus Mods!',
                                { allowReport: false });
      return Promise.resolve([]);
    } else {
      api.store.dispatch(setUpdatingMods(gameId, true));
      const start = Date.now();
      return checkModVersionsImpl(api.store, nexus, gameId, mods, forceFull)
        .then(({ errors, modIds }) => {
          if (errors.length !== 0) {
            showError(api.store.dispatch,
                      'Some mods could not be checked for updates',
                      errors.join('[br][/br]'),
                      { allowReport: false, isBBCode: true });
          }
          return Promise.resolve(modIds);
        })
        .catch(NexusError, err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err, {
            allowReport: false,
          });
          return Promise.resolve([]);
        })
        .catch(TimeoutError, err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err, {
            allowReport: false,
          });
          return Promise.resolve([]);
        })
        .catch(RateLimitError, err => {
          showError(api.store.dispatch, 'Rate limit exceeded, please try again later', err, {
            allowReport: false,
          });
          return Promise.resolve([]);
        })
        .catch(ProcessCanceled, err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err, {
            allowReport: false,
          });
          return Promise.resolve([]);
        })
        .catch(err => {
          showError(api.store.dispatch, 'An error occurred checking for mod updates', err);
          return Promise.resolve([]);
        })
        .then((modIds: string[]) => Promise.delay(2000 - (Date.now() - start))
          .then(() => modIds))
        .finally(() => {
          api.store.dispatch(setUpdatingMods(gameId, false));
        });
    }
  };
}
