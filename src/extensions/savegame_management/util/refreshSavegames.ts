import { ISavegame } from '../types/ISavegame';
import * as fs from 'fs-extra-promise';
import { savegameBinding } from 'gamebryo-savegame';
import * as path from 'path';

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
 * @param {string} installDir
 * @param {(save: ISavegame) => void} onAddSavegame
 */
function refreshSavegames(installDir: string, onAddSavegame: (save: ISavegame) => void) {
  fs.readdirAsync(installDir)
    .then((savegameNames: string[]) => {
      savegameNames.forEach((savegameName: string) => {
        savegameName = path.join(installDir, savegameName);
        loadSaveGame(savegameName, onAddSavegame);
      });
    });
}

function timestampFormat(timestamp: number) {
  let date: Date = new Date(timestamp * 1000);
  return date;
}

function loadSaveGame(file: string, onAddSavegame: Function) {
  fs.statAsync(file).then((stat: fs.Stats) => {
    if (['.ess', '.fos'].indexOf(path.extname(file)) === -1) {
      return;
    }

    let binding = savegameBinding();
    let sg = new binding.GamebryoSaveGame(file);

    const save: ISavegame = {
      id: file,
      savegameBind: sg,
      attributes: {
        id: sg.saveNumber,
        name: sg.characterName + ' - LV ' + sg.characterLevel,
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
