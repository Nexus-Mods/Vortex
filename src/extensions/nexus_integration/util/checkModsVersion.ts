import Nexus from 'nexus-api';

/**
 * check the mod version by the server call
 * 
 * @param {string} activeGameId
 * @param {Nexus} nexus
 * @param {string} modId,
 * @return {boolean} isEndorsed
 * 
 */

function checkModsVersion(
  nexus: Nexus,
  gameId: string,
  modId: number,
  currentFileId: number,
  version: string,
  uploadedTimestamp: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {

    nexus.getModFiles(modId, gameId)
      .then((result: any) => {

        let updatedMod = null;

        if (result.file_updates.length > 0) {
          updatedMod = result.file_updates.find((file) => file.old_file_id === currentFileId);
          if (updatedMod !== undefined) {
            updatedMod = result.files.find((file) => file.file_id === updatedMod.new_file_id);
            resolve(updatedMod);
          }
        }

        if (result.files.length > 0) {
          updatedMod = result.files.find((file) => file.version > version &&
            file.uploaded_timestamp > uploadedTimestamp && file.is_primary === true);
          resolve(updatedMod);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export default checkModsVersion;
