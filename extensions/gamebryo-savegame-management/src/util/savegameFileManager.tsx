import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

/**
 * copy or move a savegame file
 *
 * @param {string} sourceSavePath
 * @param {string} destSavePath
 * @param {boolean} justCopy
 */
function exportSavegameFile(sourceSavePath: string, destSavePath: string,
                            justCopy: boolean): Promise<boolean> {
  let success: boolean = false;
  if (justCopy) {
    fs.copyAsync(sourceSavePath, destSavePath)
      .then(() => success = true)
      .catch(() => success = false);
  } else {
    fs.renameAsync(sourceSavePath, destSavePath)
      .then(() => success = true)
      .catch(() => success = false);
  }
  return this.success;
}

export default exportSavegameFile;
