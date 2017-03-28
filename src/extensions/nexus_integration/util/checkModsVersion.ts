import { IFileInfo, IFileUpdates, IModFiles } from '../types/IModfiles';

import Nexus from 'nexus-api';

/**
 * check the mod version by the server call
 * 
 * @param {Nexus} nexus
 * @param {string} gameId
 * @param {string} modId
 * @param {number} currentFileId
 * @param {string} version
 * @param {number} uploadedTimestamp
 * @return {Promise<IFileInfo>} updatedMod
 * 
 */

function checkModsVersion(
  nexus: Nexus,
  gameId: string,
  modId: number,
  currentFileId: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {

    let fileCategoryIds = ['MAIN ', 'UPDATE', 'OPTIONAL'];

    nexus.getModFiles(modId, gameId)
      .then((result: IModFiles) => {
        let updatedMod: IFileInfo = undefined;

        let updatedFile = checkFileUpdates(result.file_updates, currentFileId);
        if (updatedFile !== undefined) {
          resolve(updatedFile.new_file_id);
        } else {
          updatedMod = result.files.find((file) => file.file_id === currentFileId &&
            fileCategoryIds.indexOf(file.category_name) > -1);
          if (updatedMod !== undefined) {
            resolve(updatedMod.file_id);
          } else {
            resolve(undefined);
          }
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function checkFileUpdates(fileUpdates: IFileUpdates[], currentFileId: number) {
  let updatedFile = fileUpdates.find((file) => file.old_file_id === currentFileId);
  if (updatedFile !== undefined) {
    checkFileUpdates(fileUpdates, updatedFile.new_file_id);
  }
  return updatedFile;
}

export default checkModsVersion;
