import { showError } from '../../../util/message';
import { getSafe } from '../../../util/storeHelper';
import { convertGameId } from './convertGameId';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import Nexus, { IFileInfo, IFileUpdate, IModFiles, IModInfo, NexusError } from 'nexus-api';
import * as Redux from 'redux';

/**
 * check if there is a newer mod version on the server
 *
 * @param {Nexus} nexus
 * @param {string} gameId
 * @param {string} modId
 * @param {number} newestFileId
 * @param {string} version
 * @param {number} uploadedTimestamp
 * @return {Promise<IFileInfo>} updatedMod
 *
 */
export function checkModVersion(dispatch: Redux.Dispatch<any>, nexus: Nexus,
                                gameId: string, mod: IMod): Promise<void> {
  const nexusModId: number =
      parseInt(getSafe(mod.attributes, ['modId'], undefined), 10);

  if (isNaN(nexusModId)) {
    return Promise.resolve();
  }

  return nexus.getModFiles(nexusModId, convertGameId(gameId))
      .then(result => updateFileAttributes(dispatch, gameId, mod, result));
}

/**
 * based on file update information, find the newest version of the file
 * @param fileUpdates
 * @param fileId
 */
function findLatestUpdate(fileUpdates: IFileUpdate[], updateChain: IFileUpdate[], fileId: number) {
  const updatedFile = fileUpdates.find(file => file.old_file_id === fileId);
  if (updatedFile !== undefined) {
    return findLatestUpdate(fileUpdates,
      updateChain.concat([ updatedFile ]), updatedFile.new_file_id);
  } else {
    return updateChain;
  }
}

function update(dispatch: Redux.Dispatch<any>,
                gameId: string,
                mod: IMod,
                attribute: string,
                newValue: any) {
  if (getSafe(mod.attributes, [attribute], undefined) !== newValue) {
    dispatch(setModAttribute(gameId, mod.id, attribute, newValue));
  }
}

function updateModAttributes(dispatch: Redux.Dispatch<any>,
                             gameId: string,
                             mod: IMod,
                             modInfo: IModInfo) {
  update(dispatch, gameId, mod, 'endorsed', modInfo.endorsement.endorse_status);
  update(dispatch, gameId, mod, 'description', modInfo.description);
  update(dispatch, gameId, mod, 'pictureUrl', modInfo.picture_url);
}

function updateLatestFileAttributes(dispatch: Redux.Dispatch<any>,
                                    gameId: string,
                                    mod: IMod,
                                    file: IFileInfo) {
  update(dispatch, gameId, mod, 'newestVersion', file.version);

  const fileCategories = ['MAIN', 'UPDATE', 'OPTIONAL'];
  if (fileCategories.indexOf(file.category_name) !== -1) {
    // if it wasn't found (meaning the file has either been removed from
    // the page or is in category "OLD", mark the file as "updated but
    // don't know which file)
    update(dispatch, gameId, mod, 'newestFileId', file.file_id);
  } else {
    update(dispatch, gameId, mod, 'newestFileId', 'unknown');
  }
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
    const notOld = files.files.filter(file => file.category_id !== 4);
    if ((notOld.length === 1) && (notOld[0].file_id !== fileId)) {
      fileUpdates = [{
        old_file_id: fileId,
        old_file_name: mod.attributes['fileName'],
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

  const updatedFile = fileUpdates.length > 0
    ? files.files.find(file => file.file_id === fileUpdates[fileUpdates.length - 1].new_file_id)
    : files.files.find(file => file.file_id === fileId);
  if (updatedFile !== undefined) {
    updateLatestFileAttributes(dispatch, gameId, mod, updatedFile);
  }
}

function errorFromNexus(err: NexusError): Error {
  if (err.statusCode >= 500) {
    return new Error(`Internal server error (${err.statusCode}):` + err.message);
  } else if (err.statusCode >= 400) {
    return new Error(`Not found (${err.statusCode}): ` + err.message);
  } else {
    return new Error(err.message);
  }
}

export function retrieveModInfo(
  nexus: Nexus,
  store: Redux.Store<any>,
  gameId: string,
  mod: IMod,
  t: I18next.TranslationFunction): Promise<void> {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  if ((nexusModId === undefined) || (nexusModId.length === 0)) {
    return Promise.resolve();
  }
  // if the endorsement state is unknown, request it
  return nexus.getModInfo(parseInt(nexusModId, 10), convertGameId(gameId))
    .then((modInfo: IModInfo) => {
      updateModAttributes(store.dispatch, gameId, mod, modInfo);
    })
    .catch((err: NexusError) => {
      showError(store.dispatch, 'An error occurred looking up the mod',
        errorFromNexus(err), false, undefined, false);
      // prevent this error from coming up every time the icon is re-rendered
      store.dispatch(setModAttribute(gameId, mod.id, 'endorsed', 'Undecided'));
    });
}
