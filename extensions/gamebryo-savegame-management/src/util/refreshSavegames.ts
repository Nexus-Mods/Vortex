import { ISavegame } from '../types/ISavegame';

import { log } from 'vortex-api';

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
    .then((savegameNames: string[]) => {
      return Promise.each(savegameNames, (savegameName: string) => {
        const savegamePath = path.join(savesPath, savegameName);
        return loadSaveGame(savegamePath, onAddSavegame)
        .catch((err: Error) => {
          failedReads.push(savegameName);
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

function loadSaveGame(file: string, onAddSavegame: (save: ISavegame) => void): Promise<void> {
  return fs.statAsync(file).then((stat: fs.Stats) => {
    if (['.ess', '.fos'].indexOf(path.extname(file)) === -1) {
      return;
    }

    const sg = new savegameLib.GamebryoSaveGame(file);

    const save: ISavegame = {
      id: path.basename(file),
      savegameBind: sg,
      attributes: {
        id: sg.saveNumber,
        name: sg.characterName,
        level: sg.characterLevel,
        filename: path.basename(file),
        location: sg.location,
        plugins: sg.plugins,
        screenshot: sg.screenshotSize,
        isToggleable: true,
        creationtime: timestampFormat(sg.creationTime),
      },
    };
    onAddSavegame(save);
  });

}

export default refreshSavegames;
