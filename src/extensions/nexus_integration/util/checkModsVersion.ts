import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { nexusGameId } from './convertGameId';

import { gameById } from '../../gamemode_management/selectors';
import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import { setLastUpdateCheck } from '../actions/session';

import * as Promise from 'bluebird';
import I18next from 'i18next';
import NexusT, { IFileInfo, IFileUpdate, IModFiles, IModInfo,
                 IUpdateEntry, NexusError, RateLimitError } from 'nexus-api';
import * as Redux from 'redux';
import * as semvish from 'semvish';

export const ONE_MINUTE = 60 * 1000;
export const ONE_DAY = 24 * 60 * ONE_MINUTE;
export const ONE_WEEK = 7 * ONE_DAY;
export const ONE_MONTH = 30 * ONE_DAY;
const UPDATE_CHECK_TIMEOUT = 5 * ONE_MINUTE;

/**
 * fetch a list of mods, updated within a certain time range
 *
 * @param {Redux.Store<any>} store
 * @param {NexusT} nexus
 * @param {string} gameId game to fetch for
 * @param {number} minAge timestamp of the least recently updated mod we're interested in
 * @returns {Promise<IUpdateEntry[]>}
 */
export function fetchRecentUpdates(store: Redux.Store<any>,
                                   nexus: NexusT,
                                   gameId: string,
                                   minAge: number): Promise<IUpdateEntry[]> {
  const state = store.getState();
  const now = Date.now();
  const lastUpdate = getSafe(state, ['session', 'nexus', 'lastUpdate', gameId], {
    time: 0,
    range: 0,
    updateList: [],
  });

  const timeSinceUpdate = now - lastUpdate.time;

  if ((timeSinceUpdate < UPDATE_CHECK_TIMEOUT) && ((now - minAge) < lastUpdate.range)) {
    // don't fetch same or smaller range again within 5 minutes
    return Promise.resolve(
      getSafe(state, ['session', 'nexus', 'lastUpdate', gameId, 'updateList'], []));
  } else {
    log('debug', '[update check] lru', (new Date(minAge)).toISOString());

    // round elapsed time since minAge to day/week/month
    const period = (now - minAge) < ONE_DAY
      ? '1d'
      : (now - minAge) < ONE_WEEK
      ? '1w'
      : '1m';

    const range = {
      '1d': ONE_DAY,
      '1w': ONE_WEEK,
      '1m': ONE_MONTH,
    }[period];

    log('debug', '[update check] using range', { gameId, period });

    return Promise.resolve(nexus.getRecentlyUpdatedMods(
          period, nexusGameId(gameById(state, gameId), gameId)))
      .then(recentUpdates => {
        // store 5 minutes ago for the time of the last update check, since
        // the list is cached and might be that outdated
        store.dispatch(setLastUpdateCheck(gameId, now - 5 * ONE_MINUTE, range, recentUpdates));
        return Promise.resolve(recentUpdates);
      });
  }
}

/**
 * check if there is a newer mod version on the server
 *
 * @param {NexusT} nexus
 * @param {string} gameId
 * @param {string} modId
 * @param {number} newestFileId
 * @param {string} version
 * @param {number} uploadedTimestamp
 * @return {Promise<IFileInfo>}
 *
 */
export function checkModVersion(store: Redux.Store<any>, nexus: NexusT,
                                gameMode: string, mod: IMod): Promise<void> {
  const nexusModId: number =
      parseInt(getSafe(mod.attributes, ['modId'], undefined), 10);

  if (isNaN(nexusModId)) {
    return Promise.resolve();
  }

  const gameId = getSafe(mod.attributes, ['downloadGame'], undefined) || gameMode;
  const game = gameById(store.getState(), gameId);

  return Promise.resolve(nexus.getModFiles(nexusModId, nexusGameId(game)))
      .then(result => updateFileAttributes(store.dispatch, gameMode, mod, result))
      .tapCatch(() => {
        setNoUpdateAttributes(store.dispatch, gameId, mod);
      });
}

/**
 * based on file update information, find the newest version of the file
 * @param fileUpdates
 * @param fileId
 */
function findLatestUpdate(fileUpdates: IFileUpdate[], updateChain: IFileUpdate[], fileId: number) {
  const updatedFile = fileUpdates.find(file => file.old_file_id === fileId);
  return (updatedFile !== undefined)
    ? findLatestUpdate(fileUpdates, updateChain.concat([ updatedFile ]), updatedFile.new_file_id)
    : updateChain;
}

function update(dispatch: Redux.Dispatch<any>,
                gameId: string,
                mod: IMod,
                attribute: string,
                newValue: any) {
  // previously this would only update the attribute if it was already
  // set on the mod. I just can't think of a good reason to do that any more
  dispatch(setModAttribute(gameId, mod.id, attribute, newValue));
}

function updateModAttributes(dispatch: Redux.Dispatch<any>,
                             gameId: string,
                             mod: IMod,
                             modInfo: IModInfo) {
  if (modInfo.endorsement !== undefined) {
    update(dispatch, gameId, mod, 'endorsed', modInfo.endorsement.endorse_status);
  }
  if (getSafe(mod.attributes, ['category'], undefined) === undefined) {
    update(dispatch, gameId, mod, 'category', modInfo.category_id);
  }
  update(dispatch, gameId, mod, 'shortDescription', modInfo.summary);
  update(dispatch, gameId, mod, 'description', modInfo.description);
  update(dispatch, gameId, mod, 'pictureUrl', modInfo.picture_url);
  update(dispatch, gameId, mod, 'author', modInfo.author);
}

function updateLatestFileAttributes(dispatch: Redux.Dispatch<any>,
                                    gameId: string,
                                    mod: IMod,
                                    file: IFileInfo) {
  update(dispatch, gameId, mod, 'newestVersion', file.version);

  if ((file.category_name === 'OLD_VERSION') || !truthy(file.category_name)) {
    // file was removed from mod or is old, either way there should be a new version available
    // but we have no way of determining which it is.
    update(dispatch, gameId, mod, 'newestFileId', 'unknown');
  } else {
    update(dispatch, gameId, mod, 'newestFileId', file.file_id);
  }
}

function setNoUpdateAttributes(dispatch: Redux.Dispatch<any>,
                               gameId: string,
                               mod: IMod) {
  update(dispatch, gameId, mod, 'newestVersion', undefined);
  update(dispatch, gameId, mod, 'newestFileId', undefined);
}

function updateFileAttributes(dispatch: Redux.Dispatch<any>,
                              gameId: string,
                              mod: IMod,
                              files: IModFiles) {
  const fileId = getSafe(mod.attributes, ['fileId'], undefined);
  const latestFileId = fileId;
  let fileUpdates: IFileUpdate[] = findLatestUpdate(files.file_updates, [], latestFileId);
  if (fileUpdates.length === 0) {
    // update not found through update-chain. If there is only a single file that
    // isn't marked as old we assume that is the right update.
    const notOld = files.files.filter(file => (file.category_id !== 4) && (file.category_id !== 6));
    if ((notOld.length === 1) && (notOld[0].file_id !== fileId)) {
      fileUpdates = [{
        old_file_id: fileId,
        old_file_name: getSafe(mod.attributes, ['logicalFileName'], undefined),
        new_file_id: notOld[0].file_id,
        new_file_name: notOld[0].file_name,
        uploaded_time: notOld[0].uploaded_time,
        uploaded_timestamp: notOld[0].uploaded_timestamp,
      }];
    }
  }

  // collect the changelogs of all the versions > currently installed and <= newest
  const changelog = fileUpdates
    .map(fileUpdate => {
      const file = files.files.find(iter => iter.file_id === fileUpdate.new_file_id);
      return file !== undefined ? file.changelog_html : undefined;
    })
    .filter(change => change !== undefined)
    .join('</br>');

  if (changelog.length > 0) {
    update(dispatch, gameId, mod, 'newestChangelog', { format: 'html', content: changelog });
  } else {
    update(dispatch, gameId, mod, 'newestChangelog', undefined);
  }

  let updatedFile = fileUpdates.length > 0
    ? files.files.find(file => file.file_id === fileUpdates[fileUpdates.length - 1].new_file_id)
    : files.files.find(file => file.file_id === fileId);
  if ((updatedFile === undefined) && truthy(mod.attributes.version)) {
    try {
      updatedFile = files.files.find(file => semvish.eq(file.mod_version, mod.attributes.version));
    } catch (err) {
      // nop
    }
  }
  if (updatedFile !== undefined) {
    updateLatestFileAttributes(dispatch, gameId, mod, updatedFile);
  } else {
    setNoUpdateAttributes(dispatch, gameId, mod);
  }
}

function errorFromNexus(err: NexusError): Error {
  if (err.statusCode >= 500) {
    return new Error(`Internal server error (${err.statusCode}, ${err.request}):` + err.message);
  } else if (err.statusCode >= 400) {
    return new Error(`Not found (${err.statusCode}, ${err.request}): ` + err.message);
  } else {
    return new Error(`${err.message} (${err.statusCode}, ${err.request})`);
  }
}

export function retrieveModInfo(
    nexus: NexusT,
    api: IExtensionApi,
    gameMode: string,
    mod: IMod,
    t: I18next.TFunction): Promise<void> {
  const store = api.store;
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  if ((nexusModId === undefined) || (nexusModId.length === 0)) {
    return Promise.resolve();
  }
  const gameId = getSafe(mod.attributes, ['downloadGame'], gameMode);
  const nexusIdNum = parseInt(nexusModId, 10);
  // if the endorsement state is unknown, request it
  return Promise.resolve(nexus.getModInfo(nexusIdNum,
                                          nexusGameId(gameById(store.getState(), gameId))))
    .then((modInfo: IModInfo) => {
      if (modInfo !== undefined) {
        updateModAttributes(store.dispatch, gameMode, mod, modInfo);
      }
    })
    .catch(RateLimitError, err => {
      api.sendNotification({
        id: 'rate-limit-exceeded',
        type: 'warning',
        title: 'Rate-limit exceeded',
        message: 'You wont be able to use network features until the next full hour.',
      });
    })
    .catch((err: NexusError) => {
      if (err.statusCode === 404) {
        return;
      }
      log('warn', 'An error occurred looking up a mod', {
        error: errorFromNexus(err),
        gameId,
        modId: nexusModId,
      });
    });
}
