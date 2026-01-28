import { saveFiles } from "./gameSupport";

import Promise from "bluebird";
import * as path from "path";
import { fs } from "vortex-api";

/**
 * copy or move a list of savegame files
 *
 * @param {string} sourceSavePath
 * @param {string} destSavePath
 * @param {boolean} justCopy
 */
function transferSavegames(
  gameId: string,
  savegames: string[],
  sourceSavePath: string,
  destSavePath: string,
  keepSource: boolean,
): Promise<string[]> {
  const failedCopies: string[] = [];

  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  savegames = savegames.reduce((prev, name) => {
    return prev.concat(saveFiles(gameId, name));
  }, []);

  return Promise.map(savegames, (save) =>
    operation(
      path.join(sourceSavePath, save),
      path.join(destSavePath, save),
    ).catch((err) => {
      if (err.code === "ENOENT") {
        // if the file doesn't exist the user has just deleted it in which case: screw it or,
        // much more likely, this was the copy op for the .*se file and the user didn't use
        // a script extender.
        return Promise.resolve();
      }
      failedCopies.push(save + " - " + err.message);
      return Promise.resolve();
    }),
  ).then(() => Promise.resolve(failedCopies));
}

export default transferSavegames;
