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
function refreshMods(installPath: string, onAddMod: (mod: IMod) => void) {
  return fs.readdirAsync(installPath)
    .then((modNames: string[]) => {
      return Promise.map(modNames, (modName: string) => {
        const fullPath: string = path.join(installPath, modName);
        return fs.statAsync(fullPath).then((stat: fs.Stats) => {
          const mod: IMod = {
            id: modName,
            installationPath: fullPath,
            state: 'installed',
            attributes: {
              name: modName,
              installTime: stat.ctime,
            },
          };
          onAddMod(mod);
        });
      });
    });
}

export default refreshMods;
