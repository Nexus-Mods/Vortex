import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { activeGameId, gameName, installPathForGame } from '../../util/selectors';
import walk from '../../util/walk';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { IDeploymentMethod, IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as I18next from 'i18next';
import * as path from 'path';

const app = appIn || remote.app;

class DeploymendMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  constructor(api: IExtensionApi) {
    super(
        'symlink_activator', 'Symlink Deployment',
        'Deploys mods by setting symlinks in the destination directory.',
        true,
        api);
  }

  public detailedDescription(t: I18next.TranslationFunction): string {
    return t(
      'Symbolic links are special files containing a reference to another file. '
      + 'They are supported directly by the low-level API of the operating system '
      + 'so any application trying to open a symbolic link will actually open '
      + 'the referenced file unless the application asks specifically to not be '
      + 'redirected.\n'
      + 'Advantages:\n'
      + ' - good compatibility and availability\n'
      + ' - can link across partitions (unlike hard links)\n'
      + ' - an application that absolutely needs to know can recognize a symlink '
      + '(unlike hard links)\n'
      + 'Disadvantages:\n'
      + ' - some games and applications refuse to work with symbolic links for no '
      + 'good reason.\n'
      + ' - On windows you need admin rights to create a symbolic link, even when '
      + 'your regular account has write access to source and destination.');
  }

  public isSupported(state: any, gameId: string, typeId: string): IUnavailableReason {
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }
    if (this.isGamebryoGame(gameId) || this.isUnsupportedGame(gameId)) {
      // Mods for this games use some file types that have issues working with symbolic links
      return {
        description: t => t('Incompatible with "{{name}}".', {
          replace: {
            name: gameName(state, gameId),
          },
        }),
      };
    }

    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];

    if (discovery === undefined) {
      return { description: t => t('Game not discovered.') };
    }

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
      if (!this.ensureAdmin()) {
        return { description: t => t('Requires admin rights on windows.') };
      }
    } catch (err) {
      return { description: t => err.message };
    }

    const installationPath = installPathForGame(state, gameId);
    const canary = path.join(installationPath, '__vortex_canary.tmp');

    try {
      fs.writeFileSync(canary, 'Should only exist temporarily, feel free to delete');
      fs.symlinkSync(canary, canary + '.link');
    } catch (err) {
      // EMFILE shouldn't keep us from using hard linking
      if (err.code !== 'EMFILE') {
        // the error code we're actually getting is EISDIR, which makes no sense at all
        return {
          description: t => t('Filesystem doesn\'t support hard links.'),
        };
      }
    }

    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return fs.ensureDirAsync(path.dirname(linkPath))
        .then((created: any) => {
          let tagDir: Promise<void>;
          if (created !== null) {
            const tagPath = path.join(created, LinkingDeployment.NEW_TAG_NAME);
            tagDir = fs.writeFileAsync(tagPath,
                'This directory was created by Vortex deployment and will be removed '
                + 'during purging if it\'s empty');
          } else {
            tagDir = Promise.resolve();
          }
          return tagDir.then(() => fs.symlinkAsync(sourcePath, linkPath))
            .catch(err => (err.code !== 'EEXIST')
                ? Promise.reject(err)
                : fs.removeAsync(linkPath)
                  .then(() => fs.symlinkAsync(sourcePath, linkPath)));
        });
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
        const relPath = path.relative(installPath, symlinkPath);
        if (!relPath.startsWith('..') && !path.isAbsolute(relPath)) {
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

  protected canRestore(): boolean {
    return false;
  }

  private ensureAdmin(): boolean {
    const userData = app.getPath('userData');
    // any file we know exists
    const srcFile = path.join(userData, 'Cookies');
    const destFile = path.join(userData, '__link_test');
    try {
      fs.linkSync(srcFile, destFile);
      fs.removeSync(destFile);
      return true;
    } catch (err) {
      return false;
    }
  }

  private isGamebryoGame(gameId: string): boolean {
    return [
      'morrowind', 'oblivion', 'skyrim', 'enderal', 'skyrimse', 'skyrimvr',
      'fallout3', 'fallout4', 'fallout4vr', 'falloutnv',
    ].indexOf(gameId) !== -1;
  }

  private isUnsupportedGame(gameId: string): boolean {
    const unsupportedGames = (process.platform === 'win32')
      ? ['nomanssky', 'stateofdecay', 'factorio']
      : ['nomanssky', 'stateofdecay'];

    return unsupportedGames.indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (method: IDeploymentMethod) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerDeploymentMethod(new DeploymendMethod(context.api));

  return true;
}

export default init;
