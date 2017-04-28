import { ISelectedSave } from '../types/ISavegame';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

/**
 * copy or move a savegame file
 *
 * @param {string} sourceSavePath
 * @param {string} destSavePath
 * @param {boolean} justCopy
 */
function exportSavegameFile(
  savegames: ISelectedSave[],
  sourceSavePath: string,
  destSavePath: string,
  justCopy: boolean): Promise<string[]> {
  const failedCopies: string[] = [];

  if (justCopy) {
    return Promise.map(savegames, (save: ISelectedSave) => {
      return fs.copyAsync(path.join(sourceSavePath, save.saveGameId),
        path.join(destSavePath, save.saveGameId))
        .catch((err: Error) => {
          failedCopies.push(save.saveGameId + ' - ' + err.message);
        });
    })
      .then(() => {
        return Promise.resolve(failedCopies);
      });
  } else {
    return Promise.map(savegames, (save: ISelectedSave) => {
      return fs.renameAsync(path.join(sourceSavePath, save.saveGameId),
        path.join(destSavePath, save.saveGameId))
        .catch((err: Error) => {
          failedCopies.push(save.saveGameId + ' - ' + err.message);
        });
    })
      .then(() => {
        return Promise.resolve(failedCopies);
      });
  }
}

export default exportSavegameFile;
