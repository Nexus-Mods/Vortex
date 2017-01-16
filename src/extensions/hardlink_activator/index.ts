import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { IDiscoveryResult } from '../gamemode_management/types/IStateEx';
import LinkingActivator from '../mod_management/LinkingActivator';
import {installPath} from '../mod_management/selectors';
import { IModActivator } from '../mod_management/types/IModActivator';

import walk from '../../util/walk';

import * as Promise from 'bluebird';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import * as util from 'util';

class ModActivator extends LinkingActivator {
  constructor(api: IExtensionApi) {
    super(
        'hardlink_activator', 'Hardlink activator',
        'Installs the mods by setting hard links in the destination directory. ' +
            'This implementation requires the account running NMM2 to have write access ' +
            'to the mod directory.',
        api);
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

  protected purgeLinks(installPath: string, dataPath: string): Promise<void> {
    let inos = new Set<number>();

    return walk(installPath, (iterPath: string, stats: fs.Stats) => {
      if (stats.nlink > 1) {
        inos.add(stats.ino);
      }
      return Promise.resolve();
    }).then(() => {
      walk(dataPath, (iterPath: string, stats: fs.Stats) => {
        if ((stats.nlink > 1) && (inos.has(stats.ino))) {
          return fs.unlinkAsync(iterPath);
        } else {
          return Promise.resolve();
        }
      });
    });
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return fs.ensureDirAsync(path.dirname(linkPath))
        .then(() => fs.linkAsync(sourcePath, linkPath)
                        .catch((err) => {
                          if (err.code !== 'EEXIST') { throw err; };
                        }));
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return fs.unlinkAsync(linkPath);
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.lstatAsync(linkPath).then((linkStats: fs.Stats) => {
      if (linkStats.nlink === 1) {
        return false;
      } else {
        return fs.lstatAsync(sourcePath).then((sourceStats: fs.Stats) => {
          return linkStats.ino === sourceStats.ino;
        });
      }
    });
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerModActivator(new ModActivator(context.api));

  return true;
}

export default init;
