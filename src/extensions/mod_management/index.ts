import { IExtensionContext } from '../../types/IExtensionContext';

import { addMod } from './actions/mods';
import { modsReducer } from './reducers/mods';
import { settingsReducer } from './reducers/settings';
import { IMod } from './types/IMod';
import { IModAttribute } from './types/IModAttribute';
import resolvePath from './util/resolvePath';
import ModList from './views/ModList';
import Settings from './views/Settings';

import { INSTALL_TIME, MOD_NAME } from './modAttributes';
import { startInstallFile } from './modInstall';

import * as fs from 'fs';
import * as path from 'path';

interface IExtensionContextExt extends IExtensionContext {
  registerModAttribute: (attribute: IModAttribute) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('cubes', 'Mods', ModList);
  context.registerIcon('application-icons', 'archive', 'Install from file',
    () => startInstallFile(context.api));
  context.registerSettings('Mods', Settings);
  context.registerReducer(['mods'], modsReducer);
  context.registerReducer(['gameSettings', 'mods'], settingsReducer);

  if (context.registerModAttribute !== undefined) {
    context.registerModAttribute(MOD_NAME);
    context.registerModAttribute(INSTALL_TIME);
  }

  context.once(() => {
    const installDir = resolvePath('install', context.api.getState());
    fs.readdir(installDir, (err: NodeJS.ErrnoException, mods: string[]) => {
        if (mods !== undefined){
            mods.forEach((modName: string) => {
                const fullPath: string = path.join(installDir, modName);
                const mod: IMod = {
                    id: modName,
                    installationPath: fullPath,
                    state: 'installed',
                    attributes: {
                        name: modName,
                        installTime: fs.statSync(fullPath).birthtime,
                    },
                };
                context.api.dispatch(addMod(mod));
            });
    }
    });
  });

  return true;
}

export default init;
