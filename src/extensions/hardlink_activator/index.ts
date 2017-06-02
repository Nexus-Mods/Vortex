import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import LinkingActivator from '../mod_management/LinkingActivator';
import {installPath} from '../mod_management/selectors';
import { IModActivator } from '../mod_management/types/IModActivator';

import walk from '../../util/walk';

import * as Promise from 'bluebird';
import * as fsOrig from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import * as util from 'util';

const TAG_NAME = '__delete_if_empty';

export class FileFound extends Error {
  constructor(name) {
    super(name);
    this.name = this.constructor.name;
  }
}

class ModActivator extends LinkingActivator {
  constructor(api: IExtensionApi) {
    super(
        'hardlink_activator', 'Hardlink activator',
        'Installs the mods by setting hard links in the destination directory. ' +
            'This implementation requires the account running Vortex to have write access ' +
            'to the mod directory.',
        api);
  }

  public isSupported(state: any): string {
    const gameId = activeGameId(state);
    const activeGameDiscovery: IDiscoveryResult =
      state.settings.gameMode.discovered[gameId];
    if (activeGameDiscovery === undefined) {
      return 'No game discovery';
    }

    try {
      fsOrig.accessSync(activeGameDiscovery.modPath, fsOrig.constants.W_OK);
    } catch (err) {
      log('info', 'hardlink activator not supported due to lack of write access',
        { path: activeGameDiscovery.modPath });
      return 'Can\'t write to data path';
    }

    try {
      if (fs.statSync(installPath(state)).dev !==
          fs.statSync(activeGameDiscovery.modPath).dev) {
        // hard links work only on the same drive
        return 'Works only if mods are installed on the same drive as the game.';
      }
    } catch (err) {
      // this can happen when managing the the game for the first time
      log('info', 'failed to stat. directory missing?', {
        dir1: installPath(state), dir2: activeGameDiscovery.modPath,
        err: util.inspect(err),
      });
      return 'Game not fully initialized yet, this should disappear soon.';
    }

    return undefined;
  }

  protected purgeLinks(installPath: string, dataPath: string): Promise<void> {
    const inos = new Set<number>();
    const deleteIfEmpty: string[] = [];

    // find ids of all files in our mods directory
    return walk(installPath,
                (iterPath: string, stats: fs.Stats) => {
                  if (stats.nlink > 1) {
                    inos.add(stats.ino);
                  }
                  return Promise.resolve();
                })
        // now remove all files in the game directory that have the same id
        .then(() => walk(dataPath,
                         (iterPath: string, stats: fs.Stats) => {
                           if (path.basename(iterPath) === TAG_NAME) {
                             deleteIfEmpty.push(path.dirname(iterPath));
                           }
                           return ((stats.nlink > 1) && (inos.has(stats.ino))) ?
                                      fs.unlinkAsync(iterPath) :
                                      Promise.resolve();
                         }))
        .then(() => {
          // sort by length descending
          const sorted = deleteIfEmpty.sort((lhs: string, rhs: string) => rhs.length - lhs.length);
          // go through the list and remove every dir that contains only the tag file.
          // The list is sorted is longest path first so this should remove the deepest paths first
          const findFiles = this.genFindFiles();
          Promise.mapSeries(
              sorted,
              delPath => findFiles(delPath).then(
                  hasFiles => hasFiles
                                  ? Promise.resolve()
                                  : fs.unlinkAsync(path.join(delPath, TAG_NAME))
                                      .then(() => this.rmEmptyDir(delPath))));
        });
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return fs.ensureDirAsync(path.dirname(linkPath))
        .then((created: any) => {
          let tagDir: Promise<void>;
          if (created !== null) {
            tagDir = fs.writeFileAsync(
                path.join(created, TAG_NAME),
                'This directory was created by Vortex deployment and will be removed ' +
                    'during purging if it\'s empty');
          } else {
            tagDir = Promise.resolve();
          }
          return tagDir.then(() => fs.linkAsync(sourcePath, linkPath))
              .catch((err) => {
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
    return fs.lstatAsync(linkPath).then((linkStats: fs.Stats) => {
      if (linkStats.nlink === 1) {
        return false;
      } else {
        return fs.lstatAsync(sourcePath).then(
          (sourceStats: fs.Stats) => linkStats.ino === sourceStats.ino,
        );
      }
    });
  }

  private genFindFiles(): (dirPath: string) => Promise<boolean> {
    const notEmpty = new Set<string>();

    return (dirPath: string) => {
      return walk(dirPath,
                  (iterPath: string, stats: fsOrig.Stats) => {
                    if (notEmpty.has(iterPath) ||
                        (!stats.isDirectory() &&
                         (path.basename(iterPath) !== TAG_NAME))) {
                      return Promise.reject(new FileFound(iterPath));
                    }
                    return Promise.resolve();
                  })
          .then(() => Promise.resolve(false))
          .catch(FileFound, err => {
            notEmpty.add(dirPath);
            return Promise.resolve(true);
          });
    };
  }

  private rmEmptyDir(dirPath: string): Promise<void> {
    return fs.readdirAsync(dirPath)
        .then((files: string[]) => Promise.map(
                  files,
                  file => {
                    const fullPath = path.join(dirPath, file);
                    return file === TAG_NAME ? fs.unlinkAsync(fullPath)
                                             : this.rmEmptyDir(fullPath);
                  }))
        .then(() => fs.rmdirAsync(dirPath));
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
