import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { IDiscoveryResult } from '../gamemode_management/types/IStateEx';
import { IMod } from '../mod_management/types/IMod';
import { IModActivator } from '../mod_management/types/IModActivator';

import walk from './walk';

import * as Promise from 'bluebird';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

class ModActivator implements IModActivator {
  public id: string;
  public name: string;
  public description: string;

  constructor() {
    this.id = 'link_activator';
    this.name = 'Symlink activator';
    this.description = 'Installs the mods by setting symlinks in the destination directory. '
                     + 'This implementation requires the account running NMM2 to have write access '
                     + 'to the mod directory. On Windows the account has to be an administrator.';
  }

  public isSupported(state: any): boolean {
    const activeGameId = state.settings.gameMode.current;
    const activeGameDiscovery: IDiscoveryResult =
      state.settings.gameMode.discovered[activeGameId];

    try {
      fsOrig.accessSync(activeGameDiscovery.modPath, fsOrig.constants.W_OK);
      // TODO on windows, try to create a symlink to determine if
      //   this is an administrator account
      return true;
    } catch (err) {
      return false;
    }
  }

  public prepare(modsPath: string): Promise<void> {
    return Promise.resolve();
  }

  public finalize(modsPath: string): Promise<void> {
    return Promise.resolve();
  }

  public activate(modsPath: string, mod: IMod): Promise<void> {
    log('info', 'activate mods', { modsPath, dest: mod.installationPath });
    const sourceBase: string = mod.installationPath;
    return walk(mod.installationPath, (iterPath: string, stat: fs.Stats) => {
      let relPath: string = path.relative(sourceBase, iterPath);
      let dest: string = path.join(modsPath, relPath);
      log('info', 'install', { source: iterPath, dest });
      if (stat.isDirectory()) {
        return fs.mkdirAsync(iterPath);
      } else {
        return fs.symlinkAsync(iterPath, dest).then(() => {
          log('info', 'installed', { iterPath, dest });
        }).catch((err) => {
          log('info', 'error', { err: err.message });
          throw err;
        });
      }
    });
  }

  public deactivate(modsPath: string): Promise<void> {
    return walk(modsPath, (iterPath: string, stat: fs.Stats) => {
      if (stat.isSymbolicLink()) {
        return fs.realpathAsync(iterPath)
          .then((realPath: string) => {
            log('info', 'real path', realPath);
            // TODO: we should check here if the link actually leads to the
            //   our mods directory
            return fs.unlinkAsync(iterPath);
          });
      }
    });
  }

  public isActive(): boolean {
    return false;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
}

function init(context: IExtensionContextEx): boolean {
  if (context.hasOwnProperty('registerModActivator')) {
    context.registerModActivator(new ModActivator());
  }

  return true;
}

export default init;
