import { IFileUpdates, IModFiles } from '../types/IModfiles';

import Nexus from 'nexus-api';

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

function checkModsVersion(
  nexus: Nexus,
  gameId: string,
  modId: number,
  fileId: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    nexus.getModFiles(modId, gameId)
      .then((result: IModFiles) => {
        let findFileId = fileId;
        const updatedFile = checkFileUpdates(result.file_updates, undefined, fileId);
        if (updatedFile !== undefined) {
          // best case: The author has provided file update information and this
          //   is the newest file. However: We still have to verify that file is
          //   actually available!
          findFileId = updatedFile.new_file_id;
        }
        const fileCategories = ['MAIN', 'UPDATE', 'OPTIONAL'];
        // see if the file is in a category that implies it's still up-to-date
        const remoteFile = result.files.find(file => file.file_id === findFileId);
        if ((remoteFile === undefined)
            || (fileCategories.indexOf(remoteFile.category_name) === -1)) {
          // if it wasn't found (meaning the file has either been removed from
          // the page or is in category "OLD", mark the file as "updated but
          // don't know which file)
          resolve(-1);
        } else {
          resolve(findFileId);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * based on file update information, find the newest version of the file
 * @param fileUpdates
 * @param fileId 
 */
function checkFileUpdates(fileUpdates: IFileUpdates[], iterUpdate: IFileUpdates, fileId: number) {
  let updatedFile = fileUpdates.find(file => file.old_file_id === fileId);
  if (updatedFile !== undefined) {
    return checkFileUpdates(fileUpdates, updatedFile, updatedFile.new_file_id);
  } else {
    return iterUpdate;
  }
}

export default checkModsVersion;
