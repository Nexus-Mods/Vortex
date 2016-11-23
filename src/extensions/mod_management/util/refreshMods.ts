import {IMod} from '../types/IMod';

import * as fs from 'fs-extra-promise';
import * as path from 'path';

/**
 * reads the installation dir and adds mods missing in our database
 * 
 * @param {string} installDir
 * @param {(mod: IMod) => void} onAddMod
 */
function refreshMods(installDir: string, onAddMod: (mod: IMod) => void) {
  fs.readdirAsync(installDir)
      .then((modNames: string[]) => {
        modNames.forEach((modName: string) => {
          fs.statAsync(modName).then((stat: fs.Stats) => {
            const fullPath: string = path.join(installDir, modName);
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
