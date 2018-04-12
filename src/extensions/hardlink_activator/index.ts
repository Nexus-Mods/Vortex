import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';

import { getGame } from '../gamemode_management';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { installPath } from '../mod_management/selectors';
import { IDeployedFile, IDeploymentMethod } from '../mod_management/types/IDeploymentMethod';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import turbowalk from 'turbowalk';
import * as util from 'util';

export class FileFound extends Error {
  constructor(name) {
    super(name);
    this.name = this.constructor.name;
  }
}

class DeploymentMethod extends LinkingDeployment {
  private mDirCache: Set<string>;

  constructor(api: IExtensionApi) {
    super(
        'hardlink_activator', 'Hard link deployment',
        'Deploys mods by setting hard links in the destination directory.',
        api);
  }

  public detailedDescription(t: I18next.TranslationFunction): string {
    return t(
      'File systems store files in two parts: \n'
      + ' - an index entry that contains the file name, '
      + 'access rights, change and creating times and so on\n'
      + ' - the actual file data\n'
      + 'Hard links work by creating a second index entry referencing '
      + 'the same data as the original. The second index is '
      + 'a full-fledged index, so there is no differentiation between "original" and "link" '
      + 'after the link was created.\n'
      + 'Advantages:\n'
      + ' - Perfect compatibility\n'
      + ' - No performance penalty\n'
      + ' - Wide OS and FS support\n'
      + 'Disadvantages:\n'
      + ' - Mods have to be on the same partition as the game\n'
      + ' - Due to fact hard links are so "compatible", a lot of applications will act '
      + 'as if original and link were separate files. This includes some backup solutions, tools '
      + 'that measure used disk space and so on, so it will often look like the link was actually '
      + 'a copy.');
  }

  public isSupported(state: any, gameId: string, typeId: string): string {
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if (discovery === undefined) {
      return 'No game discovery';
    }

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'hardlink activator not supported due to lack of write access',
          { typeId, path: modPaths[typeId] });
      return `Can\'t write to output directory: ${modPaths[typeId]}`;
    }

    try {
      if (fs.statSync(installPath(state)).dev !== fs.statSync(modPaths[typeId]).dev) {
        // hard links work only on the same drive
        return 'Works only if mods are installed on the same drive as the game. '
          + 'You can go to settings and change the mod directory to the same drive '
          + 'as the game.';
      }
    } catch (err) {
      // this can happen when managing the the game for the first time
      log('info', 'failed to stat. directory missing?', {
        dir1: installPath(state), dir2: modPaths[typeId],
        err: util.inspect(err),
      });
      return 'Game not fully initialized yet, this should disappear soon.';
    }

    return undefined;
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    this.mDirCache = new Set<string>();
    return super.finalize(gameId, dataPath, installationPath, progressCB)
    .then(files => {
      this.mDirCache = undefined;
      return files;
    });
  }

  protected purgeLinks(installationPath: string, dataPath: string): Promise<void> {
    const inos = new Set<number>();
    const deleteIfEmpty: string[] = [];

    // find ids of all files in our mods directory
    return turbowalk(installationPath,
                     entries => {
                       entries.forEach(entry => {
                         if (entry.linkCount > 1) {
                           inos.add(entry.id);
                         }
                       });
                     },
                     {
                       details: true,
                     })
        // now remove all files in the game directory that have the same id
        .then(() => {
          let queue = Promise.resolve();
          return turbowalk(dataPath, entries => {
            queue = queue
              .then(() => Promise.map(entries,
                entry => (entry.linkCount > 1) && inos.has(entry.id)
                  ? fs.unlinkAsync(entry.filePath)
                    .catch(err =>
                      log('warn', 'failed to remove', entry.filePath))
                  : Promise.resolve())
              .then(() => undefined));
          }, {details: true})
          .then(() => queue);
        });
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return this.ensureDir(path.dirname(linkPath))
        .then((created: any) => {
          let tagDir: Promise<void>;
          if (created !== null) {
            tagDir = fs.writeFileAsync(
                path.join(created, LinkingDeployment.TAG_NAME),
                'This directory was created by Vortex deployment and will be removed ' +
                    'during purging if it\'s empty');
          } else {
            tagDir = Promise.resolve();
          }
          return tagDir.then(() => fs.linkAsync(sourcePath, linkPath))
              .catch(err => {
                if (err.code !== 'EEXIST') {
                  throw err;
                }
              });
        });
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return fs.unlinkAsync(linkPath);
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.lstatAsync(linkPath).then(linkStats => linkStats.nlink === 1
        ? false
        : fs.lstatAsync(sourcePath)
            .then(sourceStats => linkStats.ino === sourceStats.ino));
  }

  protected canRestore(): boolean {
    return true;
  }

  private ensureDir(dirPath: string): Promise<void> {
    return (this.mDirCache === undefined) || !this.mDirCache.has(dirPath)
      ? fs.ensureDirAsync(dirPath).then(created => { this.mDirCache.add(dirPath); return created; })
      : Promise.resolve(null);
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
