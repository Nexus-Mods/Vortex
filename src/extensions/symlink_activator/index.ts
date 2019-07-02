import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { activeGameId, gameName } from '../../util/selectors';
import walk from '../../util/walk';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { IDeploymentMethod, IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import I18next from 'i18next';
import * as path from 'path';

const app = appIn || remote.app;

class DeploymendMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  public priority: number = 10;

  constructor(api: IExtensionApi) {
    super(
        'symlink_activator', 'Symlink Deployment',
        'Deploys mods by setting symlinks in the destination directory.',
        true,
        api);
  }

  public detailedDescription(t: I18next.TFunction): string {
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

    if ((discovery === undefined) || (discovery.path === undefined)) {
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

    const canary = path.join(modPaths[typeId], '__vortex_canary.tmp');

    let res: IUnavailableReason;
    try {
      try {
        fs.removeSync(canary + '.link');
      } catch (err) {}
      fs.writeFileSync(canary, 'Should only exist temporarily, feel free to delete');
      fs.symlinkSync(canary, canary + '.link');
    } catch (err) {
      if (err.code === 'EMFILE') {
        // EMFILE shouldn't keep us from using links
      } else if (err.code === 'EISDIR') {
        // the error code we're actually getting when symlinks aren't supported is EISDIR,
        // which makes no sense at all
        res = {
          description: t => t('Filesystem doesn\'t support symbolic links.'),
        };
      } else {
        // unexpected error code
        res = {
          description: t => t('Filesystem doesn\'t support symbolic links. Error: "{{error}}"',
            { replace: { error: err.message } }),
        };
      }
    }

    try {
      fs.removeSync(canary + '.link');
      fs.removeSync(canary);
    } catch (err) {
      // cleanup failed, this is almost certainly due to an AV jumping in to check these new files,
      // I mean, why would I be able to create the files but not delete them?
      // just try again later - can't do that synchronously though
      Promise.delay(100)
        .then(() => fs.removeAsync(canary + '.link'))
        .then(() => fs.removeAsync(canary))
        .catch(err => {
          log('error', 'failed to clean up canary file. This indicates we were able to create '
              + 'a file in the target directory but not delete it',
              { targetPath: modPaths[typeId], message: err.message });
        });
    }

    return res;
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
    let hadErrors = false;
    let canceled = false;

    let showDialogCallback = () => !canceled;

    // purge by removing all symbolic links that point to a file inside the install directory
    return walk(dataPath, (iterPath: string, stats: fs.Stats) => {
      if (canceled || !stats.isSymbolicLink()) {
        return Promise.resolve();
      }
      return fs.readlinkAsync(iterPath)
        .then((symlinkPath) => {
          const relPath = path.relative(installPath, symlinkPath);
          if (!relPath.startsWith('..') && !path.isAbsolute(relPath)) {
            return fs.unlinkAsync(iterPath, { showDialogCallback });
          }
        })
        .catch(err => {
          if (err instanceof UserCanceled) {
            canceled = true;
            return Promise.reject(err);
          } else if (err.code === 'ENOENT') {
            log('debug', 'link already gone', { iterPath, error: err.message });
          } else {
            hadErrors = true;
            log('error', 'failed to remove link', { iterPath, error: err.message });
          }
        });
    })
      .then(() => {
        if (hadErrors) {
          return Promise.reject(new Error('Some files could not be purged, please check the log file'));
        } else {
          return Promise.resolve();
        }
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
      try {
        // ensure the dummy file wasn't left over from a previous test
        fs.removeSync(destFile);
      } catch (err) {}
      fs.symlinkSync(srcFile, destFile);
      fs.removeSync(destFile);
      return true;
    } catch (err) {
      log('debug', 'assuming user needs elevation to create symlinks', { error: err.message });
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
