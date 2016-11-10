import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { addMod, clearMods } from './actions/mods';
import { modsReducer } from './reducers/mods';
import { settingsReducer } from './reducers/settings';
import { IMod } from './types/IMod';
import { IModActivator } from './types/IModActivator';
import { IModAttribute } from './types/IModAttribute';
import { IStatePaths } from './types/IStateSettings';
import resolvePath from './util/resolvePath';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import ModList from './views/ModList';
import Settings from './views/Settings';

import InstallContext from './InstallContext';
import { INSTALL_TIME, MOD_NAME } from './modAttributes';
import { installArchive } from './modInstall';

import * as fs from 'fs';
import * as path from 'path';

let activators: IModActivator[] = [];

export interface IExtensionContextExt extends IExtensionContext {
  registerModAttribute: (attribute: IModAttribute) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function refreshMods(paths: IStatePaths, gameMode: string, onAddMod: (mod: IMod) => void) {
  const installDir = resolvePath('install', paths, gameMode);
  log('info', 'reading mods', { paths, gameMode });
  fs.readdir(installDir, (err: NodeJS.ErrnoException, mods: string[]) => {
    if (mods === undefined) {
      return;
    }
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
      onAddMod(mod);
    });
  });
}

/**
 * return only those activators that are supported based on the current state
 * TODO: this may be a costy operation if we do it ever time the list is requested.
 *       we may want to limit what state activators may depend on and then only
 *       recalculate the list if that state changes
 * 
 * @param {*} state
 * @returns {IModActivator[]}
 */
function supportedActivators(state: any): IModActivator[] {
  return activators.filter((activator: IModActivator) => {
    return activator.isSupported(state);
  });
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('cubes', 'Mods', ModList, {
    hotkey: 'M',
  });

  context.registerIcon('application-icons', ActivationButton, () => {
    return {
      key: 'activate-button',
      activators: supportedActivators(context.api.store.getState()),
    };
  });

  context.registerIcon('application-icons', DeactivationButton, () => {
    return {
      key: 'deactivate-button',
      activators: supportedActivators(context.api.store.getState()),
    };
  });

  context.registerSettings('Mods', Settings, () => {
    return { activators: supportedActivators(context.api.store.getState()) };
  });

  context.registerReducer(['mods'], modsReducer);
  context.registerReducer(['gameSettings', 'mods'], settingsReducer);

  context.registerExtensionFunction('registerModActivator', registerModActivator);

  if (context.registerModAttribute !== undefined) {
    context.registerModAttribute(MOD_NAME);
    context.registerModAttribute(INSTALL_TIME);
  }

  context.once(() => {
    const state = context.api.store.getState();

    refreshMods(state.gameSettings.mods.paths,
      state.settings.gameMode.current,
      (mod: IMod): void => {
        context.api.store.dispatch(addMod(mod));
      });

    context.api.onStateChange(['settings', 'gameMode', 'current'],
      (previous: string, current: string) => {
        // TODO after changing the game mode it may take a moment for the system
        //   to read game-specific settings. This delay is not a proper solution
        setTimeout(() => {
          context.api.store.dispatch(clearMods());
          refreshMods(state.gameSettings.mods.paths, current, (mod: IMod) => {
            context.api.store.dispatch(addMod(mod));
          });
        }, 200);
      });

    context.api.onStateChange(['gameSettings', 'mods', 'paths'],
      (previous: IStatePaths, current: IStatePaths) => {
        context.api.store.dispatch(clearMods());
        refreshMods(current, state.settings.gameMode.current, (mod: IMod) => {
          context.api.store.dispatch(addMod(mod));
        });
      });

    let installContext = new InstallContext(context.api.store.dispatch);

    context.api.events.on('start-install', (archivePath: string) => {
      const installPath = resolvePath('install',
                                      state.gameSettings.mods.paths,
                                      state.settings.gameMode.current);
      const baseName = path.basename(archivePath, path.extname(archivePath));
      const destinationPath = path.join(installPath, baseName);

      installArchive(archivePath, destinationPath, installContext);
    });
  });

  return true;
}

export default init;
