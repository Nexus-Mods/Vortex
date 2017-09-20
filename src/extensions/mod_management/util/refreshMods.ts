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
      .then(() => fs.readdirAsync(installPath))
      .then((modNames: string[]) => {
        const filtered = modNames.filter(name => !name.startsWith('__'));
        const addedMods =
            filtered.filter((name: string) => knownMods.indexOf(name) === -1);
        const removedMods =
            knownMods.filter((name: string) => filtered.indexOf(name) === -1);

        return Promise.map(addedMods, (modName: string) => {
                        const fullPath: string =
                            path.join(installPath, modName);
                        return fs.statAsync(fullPath).then((stat: fs.Stats) => {
                          if (stat.isDirectory()) {
                            onAddMod({
                              id: modName,
                              type: '',
                              installationPath: modName,
                              state: 'installed',
                              attributes: {
                                name: modName,
                                installTime: stat.ctime,
                              },
                            });
                          }
                        });
                      }).then(() => onRemoveMods(removedMods));
      });
}

export default refreshMods;
