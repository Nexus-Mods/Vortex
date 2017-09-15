import { ISavegame } from '../types/ISavegame';

import { log, util } from 'vortex-api';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import savegameLibInit from 'gamebryo-savegame';
import * as path from 'path';

const savegameLib = savegameLibInit('savegameLib');

class Dimensions {
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

/**
 * reads the savegame dir and adds savegames missing in our database
 *
 * @param {string} savesPath
 * @param {(save: ISavegame) => void} onAddSavegame
 */
function refreshSavegames(savesPath: string,
                          onAddSavegame: (save: ISavegame) => void): Promise<string[]> {
  const failedReads: string[] = [];
  return fs.readdirAsync(savesPath)
    .filter((savePath: string) => ['.ess', 'fos'].indexOf(path.extname(savePath)) !== -1)
    .then((savegameNames: string[]) => {
      return Promise.each(savegameNames, (savegameName: string) => {
        const savegamePath = path.join(savesPath, savegameName);
        return loadSaveGame(savegamePath, onAddSavegame)
        .catch(err => (err.code === 'EBUSY')
            // if the file is busy now, there is a good chance it won't be in a moment
            ? util.delayed(500).then(() => loadSaveGame(savegamePath, onAddSavegame))
            : Promise.reject(err))
        .catch(err => {
          failedReads.push(`${savegameName} - ${err.message}`);
          log('warn', 'Failed to parse savegame', { savegamePath, error: err.message });
        });
      });
    })
    .then(() => {
      return Promise.resolve(failedReads);
    });
}

function timestampFormat(timestamp: number) {
  const date: Date = new Date(timestamp * 1000);
  return date;
}

function loadSaveGame(filePath: string, onAddSavegame: (save: ISavegame) => void,
                      tries: number = 2): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const sg = new savegameLib.GamebryoSaveGame(filePath);

      const save: ISavegame = {
        id: path.basename(filePath),
        savegameBind: sg,
        attributes: {
          id: sg.saveNumber,
          name: sg.characterName,
          level: sg.characterLevel,
          filename: path.basename(filePath),
          location: sg.location,
          plugins: sg.plugins,
          screenshot: sg.screenshotSize,
          isToggleable: true,
          creationtime: timestampFormat(sg.creationTime),
        },
      };
      onAddSavegame(save);
      resolve();
    } catch (err) {
      if (err.message.startsWith('failed to open')) {
        // error messages from the lib aren't very enlightening unfortunately.
        // it could be a temporary problem (i.e. the game currently writing the
        // save and thus it would be locked so try again).
        // this opens the file with a js function, if that fails too we get a
        // better error message we may be able to handle
        fs.openAsync(filePath, 'r')
          .then(() => reject(err))
          .catch(fserr => reject(fserr));
      } else {
        reject(err);
      }
    }
  });
}

export default refreshSavegames;
