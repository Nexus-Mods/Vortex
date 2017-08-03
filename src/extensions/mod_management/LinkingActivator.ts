import {addNotification} from '../../actions/notifications';
import {IExtensionApi} from '../../types/IExtensionContext';
import getNormalizeFunc, {Normalize} from '../../util/getNormalizeFunc';
import {log} from '../../util/log';
import * as selectors from '../../util/selectors';
import walk from '../../util/walk';

import {IMod} from './types/IMod';
import {
  IDeployedFile,
  IFileChange,
  IModActivator,
} from './types/IModActivator';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';

interface IActivation {
  [relPath: string]: IDeployedFile;
}

/**
 * base class for mod activators that use some form of file-based linking
 * (which is probably all of them)
 */
abstract class LinkingActivator implements IModActivator {
  public static TAG_NAME = '__delete_if_empty';

  public id: string;
  public name: string;
  public description: string;

  private mPreviousActivation: IActivation = {};
  private mNewActivation: IActivation = {};
  private mApi: IExtensionApi;
  private mNormalize: Normalize;

  constructor(id: string, name: string, description: string, api: IExtensionApi) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.mApi = api;
  }

  public abstract isSupported(state: any): string;

  /**
   * if necessary, get user confirmation we should deploy now. Right now this
   * is used for activators that require elevation, since this will prompt an OS dialog
   * and we don't want auto-deployment to pop up a dialog that takes the focus away
   * from the application without having the user initiate it
   *
   * @returns {Promise<void>}
   * @memberof LinkingActivator
   */
  public userGate(): Promise<void> {
    return Promise.resolve();
  }

  public prepare(dataPath: string, clean: boolean, lastActivation: IDeployedFile[]): Promise<void> {
    return getNormalizeFunc(dataPath)
      .then(func => {
        this.mNormalize = func;
        this.mNewActivation = {};
        if (!clean) {
          lastActivation.forEach(file => {
            const key = this.mNormalize(file.relPath);
            this.mPreviousActivation[key] = this.mNewActivation[key] = file;
          });
        }
      });
  }

  public finalize(dataPath: string): Promise<IDeployedFile[]> {
    const state = this.mApi.store.getState();
    const gameId = selectors.activeGameId(state);

    let added: string[];
    let removed: string[];
    let sourceChanged: string[];
    let contentChanged: string[];

    let errorCount: number = 0;

    const installPathStr = selectors.installPath(state);

    // unlink all files that were removed or changed
    ({added, removed, sourceChanged, contentChanged} =
         this.diffActivation(this.mPreviousActivation, this.mNewActivation));

    return Promise.map([].concat(removed, sourceChanged, contentChanged),
      key => this.unlinkFile(path.join(dataPath, this.mPreviousActivation[key].relPath))
          .then(() => delete this.mPreviousActivation[key])
          .catch(err => {
            log('warn', 'failed to unlink', {
              path: this.mPreviousActivation[key].relPath,
              error: err.message,
            });
            ++errorCount;
          }))
      // then, (re-)link all files that were added or changed
      .then(() => Promise.map(
        [].concat(added, sourceChanged, contentChanged),
        (key: string) => {
          const fullPath = path.join(
            installPathStr, this.mNewActivation[key].source,
            this.mNewActivation[key].relPath);
          return this.linkFile(
            path.join(dataPath,
              this.mNewActivation[key].relPath),
            fullPath)
            .then(() => this.mPreviousActivation[key] =
              this.mNewActivation[key])
            .catch(err => {
              log('warn', 'failed to link', {
                link: this.mNewActivation[key].relPath,
                source: this.mNewActivation[key].source,
                error: err.message,
              });
              ++errorCount;
            });
        }))
      .then(() => {
        if (errorCount > 0) {
          addNotification({
            type: 'error',
            title: this.mApi.translate('Activation failed'),
            message: this.mApi.translate(
              '{{count}} files were not correctly activated (see log for details)',
              { replace: { count: errorCount } }),
          });
        }

        return Object.keys(this.mPreviousActivation)
          .map(key => this.mPreviousActivation[key]);
      });
  }

  public activate(installPath: string, dataPath: string,
                  mod: IMod): Promise<void> {
    const sourceBase = path.join(installPath, mod.installationPath);
    return walk(sourceBase, (iterPath: string, stats: fs.Stats) => {
             if (!stats.isDirectory()) {
               const relPath: string = path.relative(sourceBase, iterPath);
               // mods are activated in order of ascending priority so
               // overwriting is fine here
               this.mNewActivation[this.mNormalize(relPath)] = {
                 relPath,
                 source: mod.installationPath,
                 time: stats.mtime.getTime(),
               };
             }
             return Promise.resolve();
           }).then(() => undefined);
  }

  public deactivate(installPath: string, dataPath: string,
                    mod: IMod): Promise<void> {
    const sourceBase = path.join(installPath, mod.installationPath);
    return walk(sourceBase, (iterPath: string, stats: fs.Stats) => {
             if (!stats.isDirectory()) {
               const relPath: string = path.relative(sourceBase, iterPath);
               delete this.mNewActivation[this.mNormalize(relPath)];
             }
             return Promise.resolve();
           }).then(() => undefined)
            .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
  }

  public purge(installPath: string, dataPath: string): Promise<void> {
    // purge
    return this.purgeLinks(installPath, dataPath)
        .then(() => this.removeEmptyDirs(dataPath, false))
        .then(() => undefined);
  }

  public isActive(): boolean {
    return false;
  }

  public externalChanges(installPath: string, dataPath: string,
                         activation: IDeployedFile[]): Promise<IFileChange[]> {
    const state = this.mApi.store.getState();
    const gameId = selectors.activeGameId(state);

    const nonLinks: IFileChange[] = [];

    return Promise.map(activation, fileEntry => {
      const fileDataPath = path.join(dataPath, fileEntry.relPath);
      const fileModPath = path.join(installPath, fileEntry.source, fileEntry.relPath);
      return fs.statAsync(fileDataPath)
        .then((stat: fs.Stats):
          Promise<boolean> => {
          if (stat.mtime.getTime() !== fileEntry.time) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'valchange',
            });
            return Promise.resolve(undefined);
          } else {
            return this.isLink(fileDataPath, fileModPath);
          }
        })
        .then((isLink?: boolean) => {
          // treat isLink === undefined as true!
          if (isLink === false) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'refchange',
            });
          }
        })
        .catch(err => {
          // can't stat, probably the file was deleted
          nonLinks.push({
            filePath: fileEntry.relPath,
            source: fileEntry.source,
            changeType: 'deleted',
          });
        });
      }).then(() => Promise.resolve(nonLinks));
  }

  protected abstract linkFile(linkPath: string, sourcePath: string): Promise<void>;
  protected abstract unlinkFile(linkPath: string): Promise<void>;
  protected abstract purgeLinks(installPath: string, dataPath: string): Promise<void>;
  protected abstract isLink(linkPath: string, sourcePath: string): Promise<boolean>;

  private diffActivation(before: IActivation, after: IActivation) {
    const keysBefore = Object.keys(before);
    const keysAfter = Object.keys(after);
    const keysBoth = _.intersection(keysBefore, keysAfter);
    return {
      added: _.difference(keysAfter, keysBefore),
      removed: _.difference(keysBefore, keysAfter),
      sourceChanged: keysBoth.filter((key: string) => before[key].source !== after[key].source),
      contentChanged: keysBoth.filter((key: string) => before[key].time !== after[key].time),
    };
  }

  private removeEmptyDirs(baseDir: string,
                          doRemove: boolean): Promise<boolean> {
    // recursively go through directories and remove empty ones !if! we encountered a
    // __delete_if_empty file in the hierarchy so far
    return fs.readdirAsync(baseDir)
        .then(files => {
          doRemove = doRemove || (files.indexOf(LinkingActivator.TAG_NAME) !== -1);
          let empty = true;
          // stat all files
          return Promise.map(files,
                             file => fs.statAsync(path.join(baseDir, file))
                                         .then(stat => ({file, stat})))
              .then(stats =>
                Promise.map(stats, stat => {
                  // recurse into directories
                  if (stat.stat.isDirectory()) {
                    return this.removeEmptyDirs(path.join(baseDir, stat.file),
                                                doRemove)
                        .then(removed => {
                          // if the subdir wasn't removed, this dir isn't empty either
                          if (!removed) {
                            empty = false;
                          }
                        });
                  } else if (stat.file !== LinkingActivator.TAG_NAME) {
                    // if there are any files (other than the tag file), this dir isn't
                    // empty
                    empty = false;
                  }
                  return Promise.resolve();
                }))
              .then(() => empty);
        })
        .then(isEmpty => {
          if (isEmpty && doRemove) {
            return fs.unlinkAsync(path.join(baseDir, LinkingActivator.TAG_NAME))
                .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
                .then(() => fs.rmdirAsync(baseDir))
                .then(() => true);
          } else {
            return Promise.resolve(false);
          }
        });
  }
}

export default LinkingActivator;
