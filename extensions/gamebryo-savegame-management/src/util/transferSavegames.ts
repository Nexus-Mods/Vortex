import * as Promise from 'bluebird';
import * as path from 'path';
import { fs } from 'vortex-api';

/**
 * copy or move a list of savegame files
 *
 * @param {string} sourceSavePath
 * @param {string} destSavePath
 * @param {boolean} justCopy
 */
function transferSavegames(savegames: string[],
                           sourceSavePath: string,
                           destSavePath: string,
                           keepSource: boolean): Promise<string[]> {
  const failedCopies: string[] = [];

  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  return Promise.map(savegames, save =>
    operation(path.join(sourceSavePath, save),
              path.join(destSavePath, save))
    .catch(err => {
      failedCopies.push(save + ' - ' + err.message);
    }))
    .then(() => Promise.resolve(failedCopies));
}

export default transferSavegames;
