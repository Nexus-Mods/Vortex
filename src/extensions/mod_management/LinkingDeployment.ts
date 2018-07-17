import {addNotification} from '../../actions/notifications';
import {IExtensionApi} from '../../types/IExtensionContext';
import { ProcessCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getNormalizeFunc, {Normalize} from '../../util/getNormalizeFunc';
import {log} from '../../util/log';
import { truthy } from '../../util/util';

import {
  IDeployedFile,
  IDeploymentMethod,
  IFileChange,
} from './types/IDeploymentMethod';
import {IMod} from './types/IMod';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as _ from 'lodash';
import * as path from 'path';
import turbowalk from 'turbowalk';

interface IDeployment {
  [relPath: string]: IDeployedFile;
}

// TODO: guess I need to pull this out of the linking activator as the deployment
//   code needs to know about these files when merging archives
export const BACKUP_TAG = '.vortex_backup';

interface IDeploymentContext {
  previousDeployment: IDeployment;
  newDeployment: IDeployment;
  onComplete: () => void;
}

/**
 * base class for mod activators that use some form of file-based linking
 * (which is probably all of them)
 */
abstract class LinkingActivator implements IDeploymentMethod {
  public static TAG_NAME = '__delete_if_empty';

  public id: string;
  public name: string;
  public description: string;

  private mApi: IExtensionApi;
  private mNormalize: Normalize;

  private mQueue: Promise<void> = Promise.resolve();
  private mContext: IDeploymentContext;

  constructor(id: string, name: string, description: string, api: IExtensionApi) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.mApi = api;
  }

  public abstract isSupported(state: any, gameId: string, modTypeId: string): string;

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

  public detailedDescription(t: I18next.TranslationFunction): string {
    return t(this.description);
  }

  public prepare(dataPath: string, clean: boolean, lastDeployment: IDeployedFile[]): Promise<void> {
    let queueResolve: () => void;
    const queueProm = new Promise<void>(resolve => {
      queueResolve = resolve;
    });

    const queue = this.mQueue;
    this.mQueue = this.mQueue.then(() => queueProm);

    return queue
      .then(() => {
        return getNormalizeFunc(dataPath, { unicode: false, separators: false, relative: false });
      })
      .then(normalize => {
        this.mNormalize = normalize;
        this.mContext = {
          newDeployment: {},
          previousDeployment: {},
          onComplete: queueResolve,
        };
        lastDeployment.forEach(file => {
          const key = this.mNormalize(file.relPath);
          this.mContext.previousDeployment[key] = file;
          if (!clean) {
            this.mContext.newDeployment[key] = file;
          }
        });
      });
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    if (this.mContext === undefined) {
      return Promise.reject(new Error('No deployment in progress'));
    }

    let added: string[];
    let removed: string[];
    let sourceChanged: string[];
    let contentChanged: string[];

    let errorCount: number = 0;

    // unlink all files that were removed or changed
    ({added, removed, sourceChanged, contentChanged} =
         this.diffActivation(this.mContext.previousDeployment, this.mContext.newDeployment));
    log('debug', 'deployment', {
      added: added.length,
      removed: removed.length,
      'source changed': sourceChanged.length,
      modified: contentChanged.length,
    });

    const total = added.length + removed.length + sourceChanged.length + contentChanged.length;
    let count = 0;
    const progress = () => {
      if (progressCB !== undefined) {
        ++count;
        if ((count % 1000) === 0) {
          progressCB(count, total);
        }
      }
    };

    return Promise.map([].concat(removed, sourceChanged, contentChanged),
                       key => {
                         const outputPath = path.join(
                             dataPath, this.mContext.previousDeployment[key].relPath);
                         const sourcePath = path.join(installationPath,
                           this.mContext.previousDeployment[key].source,
                           this.mContext.previousDeployment[key].relPath);
                         return this.unlinkFile(outputPath, sourcePath)
                             .catch(err => (err.code !== 'ENOENT')
                               // treat an ENOENT error for the unlink as if it was a success.
                               // The end result either way is the link doesn't exist now.
                                ? Promise.reject(err)
                                : Promise.resolve())
                             .then(() => fs.renameAsync(outputPath + BACKUP_TAG,
                                                        outputPath)
                                             .catch(() => undefined))
                             .then(() => {
                               progress();
                               delete this.mContext.previousDeployment[key];
                             })
                             .catch(err => {
                               log('warn', 'failed to unlink', {
                                 path: this.mContext.previousDeployment[key].relPath,
                                 error: err.message,
                               });
                               // need to make sure the deployment manifest
                               // reflects the actual state, otherwise we may
                               // leave files orphaned
                               this.mContext.newDeployment[key] =
                                this.mContext.previousDeployment[key];
                               let idx = sourceChanged.indexOf(key);
                               if (idx !== -1) {
                                 sourceChanged.splice(idx, 1);
                               } else {
                                 idx = contentChanged.indexOf(key);
                                 if (idx !== -1) {
                                   contentChanged.splice(idx, 1);
                                 }
                               }

                               ++errorCount;
                             });
                       })
        // then, (re-)link all files that were added
        .then(() => Promise.map(
                  added,
                  key => this.deployFile(key, installationPath, dataPath, false)
                             .catch(err => {
                               log('warn', 'failed to link', {
                                 link: this.mContext.newDeployment[key].relPath,
                                 source: this.mContext.newDeployment[key].source,
                                 error: err.message,
                               });
                               ++errorCount;
                             })
                            .then(() => progress()), { concurrency: 100 }))
        // then update modified files
        .then(() => Promise.map(
                  [].concat(sourceChanged, contentChanged),
                  (key: string) =>
                      this.deployFile(key, installationPath, dataPath, true)
                          .catch(err => {
                            log('warn', 'failed to link', {
                              link: this.mContext.newDeployment[key].relPath,
                              source: this.mContext.newDeployment[key].source,
                              error: err.message,
                            });
                            ++errorCount;
                          }).then(() => progress()), { concurrency: 100 }))
        .then(() => {
          if (errorCount > 0) {
            this.mApi.store.dispatch(addNotification({
              type: 'error',
              title: this.mApi.translate('Deployment failed'),
              message: this.mApi.translate(
                  '{{count}} files were not correctly deployed (see log for details).\n'
                  + 'The most likely reason is that files were locked by external applications '
                  + 'so please ensure no other application has a mod file open, then repeat '
                  + 'deployment.',
                  {replace: {count: errorCount}}),
            }));
          }

          const context = this.mContext;
          this.mContext = undefined;
          context.onComplete();
          return Object.keys(context.previousDeployment)
              .map(key => context.previousDeployment[key]);
        })
        .tapCatch(() => {
          const context = this.mContext;
          this.mContext = undefined;
          context.onComplete();
        });
  }

  public activate(sourcePath: string, sourceName: string, dataPath: string,
                  blackList: Set<string>): Promise<void> {
    return turbowalk(sourcePath, entries => {
      if (this.mContext === undefined) {
        return;
      }
      entries.forEach(entry => {
        const relPath: string = path.relative(sourcePath, entry.filePath);
        if (!entry.isDirectory && !blackList.has(relPath)) {
          // mods are activated in order of ascending priority so
          // overwriting is fine here
          this.mContext.newDeployment[this.mNormalize(relPath)] = {
            relPath,
            source: sourceName,
            target: dataPath,
            time: entry.mtime * 1000,
          };
        }
      });
    });
  }

  public deactivate(installPath: string, dataPath: string,
                    mod: IMod): Promise<void> {
    const sourceBase = path.join(installPath, mod.installationPath);
    return turbowalk(sourceBase, entries => {
      if (this.mContext === undefined) {
        return;
      }
      entries.forEach(entry => {
        if (!entry.isDirectory) {
          const relPath: string = path.relative(sourceBase, entry.filePath);
          delete this.mContext.newDeployment[this.mNormalize(relPath)];
        }
      });
    });
  }

  public purge(installPath: string, dataPath: string): Promise<void> {
    if (!truthy(dataPath)) {
      return Promise.reject(new Error('invalid data path'));
    }
    // purge
    return this.purgeLinks(installPath, dataPath)
      .then(() => this.postPurge(dataPath, false))
      .then(() => undefined);
  }

  public isActive(): boolean {
    return false;
  }

  public externalChanges(gameId: string,
                         installPath: string,
                         dataPath: string,
                         activation: IDeployedFile[]): Promise<IFileChange[]> {
    const nonLinks: IFileChange[] = [];

    return Promise.map(activation, fileEntry => {
      const fileDataPath = (truthy(fileEntry.target)
        ? [dataPath, fileEntry.target, fileEntry.relPath]
        : [dataPath, fileEntry.relPath]
        ).join(path.sep);
      const fileModPath = [installPath, fileEntry.source, fileEntry.relPath].join(path.sep);
      let sourceDeleted: boolean = false;
      let destDeleted: boolean = false;
      let destTime: Date;

      return this.stat(fileModPath)
        .catch(err => {
          // can't stat source, probably the file was deleted
          sourceDeleted = true;
          return Promise.resolve();
        })
        .then(() => this.statLink(fileDataPath))
        .catch(() => {
          // can't stat destination, probably the file was deleted
          destDeleted = true;
          return Promise.resolve(undefined);
        })
        .then(destStats => {
          if (destStats !== undefined) {
            destTime = destStats.mtime;
          }
          return sourceDeleted || destDeleted
            ? Promise.resolve(false)
            : this.isLink(fileDataPath, fileModPath);
        })
        .then((isLink?: boolean) => {
          if (sourceDeleted && !destDeleted && this.canRestore()) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'srcdeleted',
            });
          } else if (destDeleted && !sourceDeleted) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'deleted',
            });
          } else if (!sourceDeleted && !destDeleted && !isLink) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'refchange',
            });
          /* TODO not registering these atm as we have no way to "undo" anyway
          } else if (destTime.getTime() !== fileEntry.time) {
            nonLinks.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'valchange',
            });
          */
          }
          return Promise.resolve(undefined);
        });
      }, { concurrency: 200 }).then(() => Promise.resolve(nonLinks));
  }

  /**
   * create file link
   * Note: This function is expected to replace the target file if it exists
   */
  protected abstract linkFile(linkPath: string, sourcePath: string): Promise<void>;
  protected abstract unlinkFile(linkPath: string, sourcePath: string): Promise<void>;
  protected abstract purgeLinks(installPath: string, dataPath: string): Promise<void>;
  protected abstract isLink(linkPath: string, sourcePath: string): Promise<boolean>;
  /**
   * must return true if this deployment method is able to restore a file after the
   * "original" was deleted. This is essentially true for hard links (since the file
   * data isn't gone after removing the original) and false for everything else
   */
  protected abstract canRestore(): boolean;

  protected stat(filePath: string): Promise<fs.Stats> {
    return fs.statAsync(filePath);
  }

  protected statLink(filePath: string): Promise<fs.Stats> {
    return fs.lstatAsync(filePath);
  }

  private deployFile(key: string, installPathStr: string, dataPath: string,
                     replace: boolean): Promise<IDeployedFile> {
    const fullPath =
      [installPathStr, this.mContext.newDeployment[key].source,
        this.mContext.newDeployment[key].relPath].join(path.sep);
    const fullOutputPath =
      [dataPath, this.mContext.newDeployment[key].target || '',
        this.mContext.newDeployment[key].relPath].join(path.sep);

    const backupProm: Promise<void> = replace
      ? Promise.resolve()
      : this.isLink(fullOutputPath, fullPath)
        .then(link => link
          ? Promise.resolve(undefined) // don't re-create link that's already correct
          : fs.renameAsync(fullOutputPath, fullOutputPath + BACKUP_TAG))
        .catch(err => (err.code === 'ENOENT')
          // if the backup fails because there is nothing to backup, that's great,
          // that's the most common outcome. Otherwise we failed to backup an existing
          // file, so continuing could cause data loss
          ? Promise.resolve(undefined)
          : Promise.reject(err));

    return backupProm
      .then(() => this.linkFile(fullOutputPath, fullPath))
      .then(() => {
        this.mContext.previousDeployment[key] = this.mContext.newDeployment[key];
        return this.mContext.newDeployment[key];
      });
  }

  private diffActivation(before: IDeployment, after: IDeployment) {
    const keysBefore = Object.keys(before);
    const keysAfter = Object.keys(after);
    const keysBoth = _.intersection(keysBefore, keysAfter);
    return {
      added: _.difference(keysAfter, keysBefore),
      removed: _.difference(keysBefore, keysAfter),
      sourceChanged: keysBoth.filter((key: string) => before[key].source !== after[key].source),
      contentChanged: keysBoth.filter((key: string) =>
         (before[key].time !== after[key].time) && (before[key].source === after[key].source)),
    };
  }

  private postPurge(baseDir: string, doRemove: boolean): Promise<boolean> {
    // recursively go through directories and remove empty ones !if! we encountered a
    // __delete_if_empty file in the hierarchy so far
    let empty = true;
    let queue = Promise.resolve();
    return turbowalk(baseDir, entries => {
      doRemove = doRemove ||
        (entries.find(entry =>
          !entry.isDirectory
          && path.basename(entry.filePath) === LinkingActivator.TAG_NAME) !== undefined);
      const dirs = entries.filter(entry => entry.isDirectory);
      // recurse into subdirectories
      queue = queue.then(() =>
        Promise.each(dirs, dir => this.postPurge(dir.filePath, doRemove)
                                    .then(removed => {
                                      if (!removed) { empty = false; }
                                    }))
        .then(() => {
          // then check files. if there are any, this isn't empty. plus we
          // restore backups here
          const files = entries.filter(entry => !entry.isDirectory &&
                                      path.basename(entry.filePath) !==
                                          LinkingActivator.TAG_NAME);
          if (files.length > 0) {
            empty = false;
            return Promise.map(
                files.filter(entry =>
                                 path.extname(entry.filePath) === BACKUP_TAG),
                entry => fs.renameAsync(
                    entry.filePath,
                    entry.filePath.substr(
                        0, entry.filePath.length - BACKUP_TAG.length)))
              .then(() => undefined);
          } else {
            return Promise.resolve();
          }
        }));
    }, { recurse: false })
    .then(() => queue)
        .then(() => (empty && doRemove)
          ? fs.unlinkAsync(path.join(baseDir, LinkingActivator.TAG_NAME))
                .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
                .then(() => fs.rmdirAsync(baseDir))
                .then(() => true)
          : Promise.resolve(false));
  }
}

export default LinkingActivator;
