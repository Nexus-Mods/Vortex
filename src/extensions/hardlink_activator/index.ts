import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { IDiscoveryResult } from '../gamemode_management/types/IStateEx';
import {installPath} from '../mod_management/selectors';
import { IMod } from '../mod_management/types/IMod';
import { IModActivator } from '../mod_management/types/IModActivator';

import walk from '../../util/walk';

import * as Promise from 'bluebird';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import * as util from 'util';

class ModActivator implements IModActivator {
  public id: string;
  public name: string;
  public description: string;

  constructor() {
    this.id = 'link_activator';
    this.name = 'Hardlink activator';
    this.description = 'Installs the mods by setting hard links in the destination directory. '
                     + 'This implementation requires the account running NMM2 to have write access '
                     + 'to the mod directory.';
  }

  public isSupported(state: any): boolean {
    const activeGameId = state.settings.gameMode.current;
    const activeGameDiscovery: IDiscoveryResult =
      state.settings.gameMode.discovered[activeGameId];

    try {
      fsOrig.accessSync(activeGameDiscovery.modPath, fsOrig.constants.W_OK);
    } catch (err) {
      log('info', 'hardlink activator not supported due to lack of write access',
        { path: activeGameDiscovery.modPath, err: util.inspect(err) });
      return false;
    }

    try {
      if (fs.statSync(installPath(state)).dev !==
          fs.statSync(activeGameDiscovery.modPath).dev) {
        log('info', 'hardlink activator not supported because game is on different drive');
        // hard links work only on the same drive
        return false;
      }
    } catch (err) {
      log('warn', 'failed to stat. directory missing?', {
        dir1: installPath(state), dir2: activeGameDiscovery.modPath,
        err: util.inspect(err),
      });
      return false;
    }

    return true;
  }

  public prepare(modsPath: string): Promise<void> {
    return Promise.resolve();
  }

  public finalize(modsPath: string): Promise<void> {
    return Promise.resolve();
  }

  public activate(modsPath: string, mod: IMod): Promise<void> {
    const sourceBase: string = mod.installationPath;
    return walk(mod.installationPath, (iterPath: string, stat: fs.Stats) => {
      let relPath: string = path.relative(sourceBase, iterPath);
      let dest: string = path.join(modsPath, relPath);
      if (stat.isDirectory()) {
        return fs.mkdirAsync(dest).catch((err) => {
          log('info', 'mkdir', util.inspect(err));
          if (err.code !== 'EEXIST') {
            throw err;
          }
        });
      } else {
        return fs.unlinkAsync(dest)
        .catch((err) => {
          log('info', 'unlink failed', util.inspect(err));
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }).then(() => {
          return fs.linkAsync(iterPath, dest);
        }).then(() => {
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
