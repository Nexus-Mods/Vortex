import {IMod} from '../types/IMod';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

/**
 * reads the installation dir and adds mods missing in our database
 * 
 * @param {string} installPath
 * @param {(mod: IMod) => void} onAddMod
 */
function refreshMods(installPath: string, knownMods: string[],
                     onAddMod: (mod: IMod) => void, onRemoveMods: (names: string[]) => void) {
  return fs.ensureDirAsync(installPath)
    .then(() => {
      return fs.readdirAsync(installPath);
    })
    .then((modNames: string[]) => {
      let addedMods = modNames.filter((name: string) => knownMods.indexOf(name) === -1);
      let removedMods = knownMods.filter((name: string) => modNames.indexOf(name) === -1);

      return Promise.map(addedMods, (modName: string) => {
        const fullPath: string = path.join(installPath, modName);
        return fs.statAsync(fullPath)
        .then((stat: fs.Stats) => {
          const mod: IMod = {
            id: modName,
            installationPath: modName,
            state: 'installed',
            attributes: {
              name: modName,
              installTime: stat.ctime,
            },
          };
          onAddMod(mod);
        });
      })
      .then(() => {
        onRemoveMods(removedMods);
      });
    });
}

export default refreshMods;
