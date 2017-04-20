import { showError } from '../../../util/message';
import { getSafe } from '../../../util/storeHelper';
import { convertGameId } from './convertGameId';

import { setModAttribute } from '../../mod_management/actions/mods';
import { IMod } from '../../mod_management/types/IMod';

import * as Promise from 'bluebird';
import Nexus, { IFileInfo, IFileUpdate, IModFiles, IModInfo } from 'nexus-api';

/**
 * check the mod version by the server call
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
export function checkModsVersion(dispatch: Redux.Dispatch<any>, nexus: Nexus,
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
  let updatedFile = fileUpdates.find(file => file.old_file_id === fileId);
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
  let latestFileId = fileId;
  const fileUpdate: IFileUpdate[] = findLatestUpdate(files.file_updates, [], latestFileId);

  // collect the changelogs of all the versions > currently installed and <= newest
  // TODO this is untested currently, first need to find a mod that provides update info
  //   /and/ a changelog
  const changelog = fileUpdate
    .map(update => {
      const file = files.files.find(iter => iter.file_id === update.new_file_id);
      return file !== undefined ? file.changelog_html : undefined;
    })
    .filter(change => change !== undefined)
    .join('</br>');

  if (changelog.length > 0) {
    update(dispatch, gameId, mod, 'newestChangelog', { format: 'html', content: changelog });
  } else {
    update(dispatch, gameId, mod, 'newestChangelog', undefined);
  }

  const updatedFile = fileUpdate.length > 0
    ? files.files.find(file => file.file_id === fileUpdate[fileUpdate.length - 1].new_file_id)
    : files.files.find(file => file.file_id === fileId);
  if (updatedFile !== undefined) {
    updateLatestFileAttributes(dispatch, gameId, mod, updatedFile);
  }
}

// TODO we should call this in response to the nexus-id being changed and
// if the info is currently missing
export function retrieveModInfo(
  nexus: Nexus,
  store: Redux.Store<any>,
  gameId: string,
  mod: IMod,
  t: I18next.TranslationFunction): Promise<void> {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);

  // if the endorsement state is unknown, request it
  return nexus.getModInfo(parseInt(nexusModId, 10), convertGameId(gameId))
    .then((modInfo: IModInfo) => {
      updateModAttributes(store.dispatch, gameId, mod, modInfo);
    })
    .catch((err) => {
      showError(store.dispatch, 'An error occurred looking up the mod', err);
      // prevent this error to come up every time the icon is re-rendered
      store.dispatch(setModAttribute(gameId, mod.id, 'endorsed', 'Undecided'));
    });
}
