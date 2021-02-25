import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { installPathForGame } from '../../util/selectors';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { IDeployedFile, IDeploymentMethod,
         IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';
import turbowalk from 'turbowalk';
import * as util from 'util';
import * as winapi from 'winapi-bindings';
import { setSettingsPage } from '../../actions/session';

export class FileFound extends Error {
  constructor(name) {
    super(name);
    this.name = this.constructor.name;
  }
}

class DeploymentMethod extends LinkingDeployment {
  public priority: number = 5;

  private mInstallationFiles: Set<number>;

  constructor(api: IExtensionApi) {
    super(
        'hardlink_activator', 'Hardlink Deployment',
        'Deploys mods by setting hard links in the destination directory.',
        true,
        api);
  }

  public detailedDescription(t: TFunction): string {
    return t(
      'File Systems store files in two parts: \n'
      + ' - an index entry that contains the file name, '
      + 'access rights, change and creating times and so on\n'
      + ' - the actual file data\n'
      + 'Hard Links work by creating a second index entry referencing '
      + 'the same data as the original. The second index is '
      + 'a full-fledged index, so there is no differentiation between "original" and "link" '
      + 'after the link was created.\n'
      + 'Advantages:\n'
      + ' - perfect compatibility with all applications\n'
      + ' - no performance penalty\n'
      + ' - Wide OS and FS support\n'
      + 'Disadvantages:\n'
      + ' - mods have to be on the same partition as the game\n'
      + ' - Due to fact hard links are so "compatible", a lot of applications will act '
      + 'as if original and link were separate files. This includes some backup solutions, tools '
      + 'that measure used disk space and so on, so it will often look like the link was actually '
      + 'a copy.');
  }

  public isSupported(state: any, gameId: string, typeId: string): IUnavailableReason {
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if ((discovery === undefined) || (discovery.path === undefined)) {
      return {
        description: t => t('Game not discovered.'),
      };
    }

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    if (modPaths[typeId] === undefined) {
      return undefined;
    }

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'hardlink deployment not supported due to lack of write access',
          { typeId, path: modPaths[typeId] });
      return {
        description: t => t('Can\'t write to output directory.'),
        order: 3,
        solution: t => t('To resolve this problem, the current user account needs to be given '
                       + 'write permission to "{{modPath}}".', {
          replace: {
            modPath: modPaths[typeId],
          },
        }),
      };
    }

    const installationPath = installPathForGame(state, gameId);

    try {
      if (fs.statSync(installationPath).dev !== fs.statSync(modPaths[typeId]).dev) {
        // hard links work only on the same drive
        return {
          description: t => t('Works only if mods are installed on the same drive as the game.'),
          order: 5,
          solution: t => {
            let displayPath = modPaths[typeId];
            try {
              displayPath = winapi.GetVolumePathName(modPaths[typeId]);
            } catch (err) {
              log('warn', 'Failed to resolve volume path', { path: modPaths[typeId] });
            }
            return t('Please go to Settings->Mods and set the mod staging folder to be on '
              + 'the same drive as the game ({{gameVolume}}).', {
                replace: {
                  gameVolume: displayPath,
                },
              });
          },
          fixCallback: (api: IExtensionApi) => new Promise((resolve, reject) => {
            api.events.emit('show-main-page', 'application_settings');
            api.store.dispatch(setSettingsPage('Mods'));
            api.highlightControl('#install-path-form',
                                 5000,
                                 'Change this to be on the same drive as the game.');
          }),
        };
      }
    } catch (err) {
      // this can happen when managing the the game for the first time
      log('info', 'failed to stat. directory missing?', {
        dir1: installationPath || 'undefined', dir2: modPaths[typeId],
        err: util.inspect(err),
      });
      return {
        description: t => t('Game not fully initialized yet, this should disappear soon.'),
      };
    }

    const canary = path.join(installationPath, '__vortex_canary.tmp');

    let res: IUnavailableReason;

    try {
      try {
        fs.removeSync(canary + '.link');
      } catch (err) {
        // nop
      }
      fs.writeFileSync(canary, 'Should only exist temporarily, feel free to delete');
      fs.linkSync(canary, canary + '.link');
    } catch (err) {
      // EMFILE shouldn't keep us from using hard linking
      if (err.code !== 'EMFILE') {
        // the error code we're actually getting is EISDIR, which makes no sense at all
        res = {
          description: t => t('Filesystem doesn\'t support hard links.'),
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
              { installationPath, message: err.message });
        });
    }

    return res;
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    return super.finalize(gameId, dataPath, installationPath, progressCB);
  }

  public postPurge(): Promise<void> {
    delete this.mInstallationFiles;
    this.mInstallationFiles = undefined;
    return Promise.resolve();
  }

  protected purgeLinks(installationPath: string, dataPath: string): Promise<void> {
    let installEntryProm: Promise<Set<number>>;

    // find ids of all files in our mods directory
    if (this.mInstallationFiles !== undefined) {
      installEntryProm = Promise.resolve(this.mInstallationFiles);
    } else {
      this.mInstallationFiles = new Set<number>();
      installEntryProm = turbowalk(installationPath,
        entries => {
          if (this.mInstallationFiles === undefined) {
            // don't know when this would be necessary but apparently
            // it is, see https://github.com/Nexus-Mods/Vortex/issues/3684
            return;
          }
          entries.forEach(entry => {
            if (entry.linkCount > 1) {
              this.mInstallationFiles.add(entry.id);
            }
          });
        },
        {
          details: true,
          skipHidden: false,
        })
        .catch(err => (['ENOENT', 'ENOTFOUND'].includes(err.code))
          ? Promise.resolve()
          : Promise.reject(err))
        .then(() => Promise.resolve(this.mInstallationFiles));
    }

    // now remove all files in the game directory that have the same id
    // as a file in the mods directory
    return installEntryProm.then(inos => {
      let queue = Promise.resolve();
      if (inos.size === 0) {
        return Promise.resolve();
      }
      return turbowalk(dataPath, entries => {
        queue = queue
          .then(() => Promise.map(entries,
            entry => (entry.linkCount > 1) && inos.has(entry.id)
              ? fs.unlinkAsync(entry.filePath)
                .catch(err =>
                  log('warn', 'failed to remove', entry.filePath))
              : Promise.resolve())
            .then(() => undefined));
      }, { details: true, skipHidden: false })
        .then(() => queue);
    });
  }

  protected linkFile(linkPath: string, sourcePath: string, dirTags?: boolean): Promise<void> {
    return this.ensureDir(path.dirname(linkPath), dirTags)
      .then(() => fs.linkAsync(sourcePath, linkPath))
        .catch(err => (err.code !== 'EEXIST')
          ? Promise.reject(err)
          : fs.removeAsync(linkPath)
            .then(() => fs.linkAsync(sourcePath, linkPath)));
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return fs.unlinkAsync(linkPath);
  }

  protected isLink(linkPath: string, sourcePath: string,
                   linkStatsIn: fs.Stats, sourceStatsIn: fs.Stats): Promise<boolean> {
    if ((linkStatsIn !== undefined) && (sourceStatsIn !== undefined)) {
      return Promise.resolve((linkStatsIn.nlink > 1)
                          && (linkStatsIn.ino === sourceStatsIn.ino));
    }

    return fs.lstatAsync(linkPath)
      .then(linkStats => linkStats.nlink === 1
        ? Promise.resolve(false)
        : fs.lstatAsync(sourcePath)
            .then(sourceStats => linkStats.ino === sourceStats.ino))
      .catch(err => (err.code === 'ENOENT')
        ? Promise.resolve(false)
        : Promise.reject(err));
  }

  protected canRestore(): boolean {
    return true;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (activator: IDeploymentMethod) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerDeploymentMethod(new DeploymentMethod(context.api));

  return true;
}

export default init;
