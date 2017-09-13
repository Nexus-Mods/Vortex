import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { activeGameId, gameName } from '../../util/selectors';
import walk from '../../util/walk';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import LinkingActivator from '../mod_management/LinkingActivator';
import { IModActivator } from '../mod_management/types/IModActivator';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

const app = appIn || remote.app;

class ModActivator extends LinkingActivator {
  public id: string;
  public name: string;
  public description: string;

  constructor(api: IExtensionApi) {
    super(
        'symlink_activator', 'Symlink deployment',
        'Installs the mods by setting symlinks in the destination directory. ' +
            'This implementation requires the account running Vortex to have write access ' +
            'to the mod directory. On Windows the account has to be an administrator.',
            api);
  }

  public isSupported(state: any, gameId?: string): string {
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }
    if (this.isGamebryoGame(gameId)) {
      // gamebryo engine seems to have some check on FindFirstFile/FindNextFile results that
      // makes it ignore symbolic links
      return 'Doesn\'t work with games based on the gamebryo engine '
        + '(including Skyrim SE and Fallout 4)';
    }
    if (this.isUnsupportedGame(gameId)) {
      // Mods for this games use some file types that have issues working with symbolic links
      return 'Doesn\'t work with ' + gameName(state, gameId);
    }

    const activeGameDiscovery: IDiscoveryResult =
      state.settings.gameMode.discovered[gameId];

    try {
      fsOrig.accessSync(activeGameDiscovery.modPath, fsOrig.constants.W_OK);
      if (!this.ensureAdmin()) {
        return 'Requires admin rights on windows';
      }
    } catch (err) {
      return err.message;
    }
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return fs.symlinkAsync(sourcePath, linkPath);
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return fs.lstatAsync(linkPath)
    .then(stats => {
      if (stats.isSymbolicLink()) {
        return fs.removeAsync(linkPath);
      } else {
        // should we report the attempt to remove a non-link as an error?
        log('warn', 'attempt to unlink a file that\'s not a link', { linkPath });
      }
    });
  }

  protected purgeLinks(installPath: string, dataPath: string): Promise<void> {
    // purge by removing all symbolic links that point to a file inside the install directory
    return walk(dataPath, (iterPath: string, stats: fs.Stats) => {
      if (!stats.isSymbolicLink()) {
        return Promise.resolve();
      }
      return fs.readlinkAsync(iterPath)
      .then((symlinkPath) => {
        if (!path.relative(installPath, symlinkPath).startsWith('..')) {
          return fs.removeAsync(symlinkPath);
        }
      });
    });
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.readlinkAsync(linkPath)
    .then(symlinkPath => symlinkPath === sourcePath)
    // readlink throws an "unknown" error if the file is no link at all. Super helpful
    .catch(() => false);
  }

  private ensureAdmin(): boolean {
    const userData = app.getPath('userData');
    // any file we know exists
    const srcFile = path.join(userData, 'Cookies');
    const destFile = path.join(userData, '__link_test');
    try {
      fs.linkSync(srcFile, destFile);
      fs.removeSync(destFile);
    } catch (err) {
      return false;
    }
  }

  private isGamebryoGame(gameId: string): boolean {
    return ['skyrim', 'skyrimse', 'fallout4', 'falloutnv', 'oblivion'].indexOf(gameId) !== -1;
  }

  private isUnsupportedGame(gameId: string): boolean {
    return ['nomanssky', 'stateofdecay'].indexOf(gameId) !== -1;
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
