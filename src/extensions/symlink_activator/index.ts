import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';
import walk from '../../util/walk';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IMod } from '../mod_management/types/IMod';
import { IFileChange, IModActivator } from '../mod_management/types/IModActivator';

import * as Promise from 'bluebird';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

class ModActivator implements IModActivator {
  public id: string;
  public name: string;
  public description: string;

  constructor() {
    this.id = 'symlink_activator';
    this.name = 'Symlink activator';
    this.description = 'Installs the mods by setting symlinks in the destination directory. '
                     + 'This implementation requires the account running NMM2 to have write access '
                     + 'to the mod directory. On Windows the account has to be an administrator.';
  }

  public isSupported(state: any): string {
    const gameMode = activeGameId(state);
    if (this.isGamebryoGame(gameMode)) {
      // gamebryo engine seems to have some check on FindFirstFile/FindNextFile results that
      // makes it ignore symbolic links
      return 'Doesn\'t work with the gamebryo engine.';
    }

    const activeGameDiscovery: IDiscoveryResult =
      state.settings.gameMode.discovered[gameMode];

    try {
      fsOrig.accessSync(activeGameDiscovery.modPath, fsOrig.constants.W_OK);
      // TODO on windows, try to create a symlink to determine if
      //   this is an administrator account
      return undefined;
    } catch (err) {
      return err.message;
    }
  }

  public prepare(dataPath: string): Promise<void> {
    return Promise.resolve();
  }

  public finalize(dataPath: string): Promise<void> {
    return Promise.resolve();
  }

  public activate(installPath: string, dataPath: string, mod: IMod): Promise<void> {
    const sourceBase: string = mod.installationPath;
    return walk(path.join(installPath, mod.installationPath),
                (iterPath: string, stat: fs.Stats) => {
                  let relPath: string = path.relative(sourceBase, iterPath);
                  let dest: string = path.join(dataPath, relPath);
                  if (stat.isDirectory()) {
                    return fs.mkdirAsync(dest);
                  } else {
                    return fs.symlinkAsync(iterPath, dest)
                        .then(() => {
                          log('info', 'installed', {iterPath, dest});
                        })
                        .catch((err) => {
                          log('info', 'error', {err: err.message});
                          throw err;
                        });
                  }
                });
  }

  public purge(installPath: string, dataPath: string): Promise<void> {
    return walk(dataPath, (iterPath: string, stat: fs.Stats) => {
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

  public externalChanges(installPath: string, dataPath: string): Promise<IFileChange[]> {
    return Promise.resolve([]);
  }

  public isActive(): boolean {
    return false;
  }

  private isGamebryoGame(gameId: string): boolean {
    return ['skyrim', 'skyrimse', 'fallout4', 'falloutnv', 'oblivion'].indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerModActivator(new ModActivator());

  return true;
}

export default init;
