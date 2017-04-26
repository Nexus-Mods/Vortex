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
                            justCopy: boolean): Promise<void> {
  if (justCopy) {
    return fs.copyAsync(sourceSavePath, destSavePath);
  } else {
    return fs.renameAsync(sourceSavePath, destSavePath);
  }
}

export default exportSavegameFile;
