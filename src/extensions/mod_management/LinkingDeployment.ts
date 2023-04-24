import {addNotification} from '../../actions/notifications';
import {IExtensionApi} from '../../types/IExtensionContext';
import { DirectoryCleaningMode, IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import { getGame, UserCanceled } from '../../util/api';
import * as fs from '../../util/fs';
import {Normalize} from '../../util/getNormalizeFunc';
import {log} from '../../util/log';
import { activeGameId } from '../../util/selectors';
import { truthy } from '../../util/util';

import {
  IDeployedFile,
  IDeploymentMethod,
  IFileChange,
  IUnavailableReason,
} from './types/IDeploymentMethod';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as _ from 'lodash';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';

export interface IDeployment {
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
  public static OLD_TAG_NAME = '__delete_if_empty';
  public static NEW_TAG_NAME = process.platform === 'win32'
    ? '__folder_managed_by_vortex'
    : '.__folder_managed_by_vortex';

  private static isTagName(name: string) {
    return (path.basename(name) === LinkingActivator.OLD_TAG_NAME)
      || (path.basename(name) === LinkingActivator.NEW_TAG_NAME);
  }

  public id: string;
  public name: string;
  public description: string;
  public priority: number;
  public isFallbackPurgeSafe: boolean;

  private mApi: IExtensionApi;
  private mNormalize: Normalize;

  private mQueue: Promise<void> = Promise.resolve();
  private mContext: IDeploymentContext;
  private mDirCache: Set<string>;

  constructor(id: string, name: string, description: string,
              fallbackPurgeSafe: boolean, api: IExtensionApi) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.isFallbackPurgeSafe = fallbackPurgeSafe;
    this.mApi = api;
  }

  public abstract isSupported(state: any, gameId: string, modTypeId: string): IUnavailableReason;

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

  public detailedDescription(t: TFunction): string {
    return t(this.description);
  }

  public prepare(dataPath: string, clean: boolean, lastDeployment: IDeployedFile[],
                 normalize: Normalize): Promise<void> {
    let queueResolve: () => void;
    const queueProm = new Promise<void>(resolve => {
      queueResolve = resolve;
    });

    const queue = this.mQueue;
    this.mQueue = this.mQueue.then(() => queueProm);
    this.mNormalize = normalize;

    return queue
      .then(() => {
        this.mContext = {
          newDeployment: {},
          previousDeployment: {},
          onComplete: queueResolve,
        };
        lastDeployment.forEach(file => {
          const outputPath = [file.target || null, file.relPath]
            .filter(i => i !== null).join(path.sep);
          const key = this.mNormalize(outputPath);
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
      const err = new Error('No deployment in progress');
      err['attachLogOnReport'] = true;
      return Promise.reject(err);
    }

    const context = this.mContext;

    let added: string[];
    let removed: string[];
    let sourceChanged: string[];
    let contentChanged: string[];

    let errorCount: number = 0;

    this.mDirCache = new Set<string>();

    // unlink all files that were removed or changed
    ({added, removed, sourceChanged, contentChanged} =
         this.diffActivation(context.previousDeployment, context.newDeployment));
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

    const game: IGame = getGame(gameId);
    const directoryCleaning = game.directoryCleaning || 'tag';
    const dirTags = directoryCleaning === 'tag';

    const initialDeployment = {...context.previousDeployment};

    return Promise.map(removed, key =>
        this.removeDeployedFile(installationPath, dataPath, key, true)
          .catch(err => {
            log('warn', 'failed to remove deployed file', {
              link: context.newDeployment[key].relPath,
              error: err.message,
            });
            ++errorCount;
          }))
      .then(() => Promise.map(sourceChanged, (key: string, idx: number) =>
          this.removeDeployedFile(installationPath, dataPath, key, false)
          .catch(err => {
            log('warn', 'failed to remove deployed file', {
              link: context.newDeployment[key].relPath,
              error: err.message,
            });
            ++errorCount;
            sourceChanged.splice(idx, 1);
          })))
      .then(() => Promise.map(contentChanged, (key: string, idx: number) =>
          this.removeDeployedFile(installationPath, dataPath, key, false)
          .catch(err => {
            log('warn', 'failed to remove deployed file', {
              link: context.newDeployment[key].relPath,
              error: err.message,
            });
            ++errorCount;
            contentChanged.splice(idx, 1);
          })))
        // then, (re-)link all files that were added
        .then(() => Promise.map(
                  added,
                  key => this.deployFile(key, installationPath, dataPath, false, dirTags)
                    .catch(err => {
                      log('warn', 'failed to link', {
                        link: context.newDeployment[key].relPath,
                        source: context.newDeployment[key].source,
                        error: err.message,
                      });
                      if (err.code !== 'ENOENT') {
                        // if the source file doesn't exist it must have been deleted
                        // in the mean time. That's not really our problem.
                        ++errorCount;
                      }
                    })
                            .then(() => progress()), { concurrency: 100 }))
        // then update modified files
        .then(() => Promise.map(
                  [].concat(sourceChanged, contentChanged),
                  (key: string) =>
                      this.deployFile(key, installationPath, dataPath, true, dirTags)
                          .catch(err => {
                            log('warn', 'failed to link', {
                              link: context.newDeployment[key].relPath,
                              source: context.newDeployment[key].source,
                              error: err.message,
                            });
                            if (err.code !== 'ENOENT') {
                              ++errorCount;
                            }
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

          const state: IState = this.mApi.store.getState();
          const { cleanupOnDeploy } = state.settings.mods;
          const gameRequiresCleanup = (game.requiresCleanup === undefined)
            ? (game.mergeMods !== true)
            : game.requiresCleanup;
          if ((removed.length > 0) && (gameRequiresCleanup || cleanupOnDeploy)) {
            this.postLinkPurge(dataPath, false, false, directoryCleaning)
              .catch(UserCanceled, () => null)
              .catch(err => {
                this.mApi.showErrorNotification('Failed to clean up',
                  err, { message: dataPath });
              });
          }

          this.mContext = undefined;
          context.onComplete();
          return Object.keys(context.previousDeployment)
              .map(key => context.previousDeployment[key]);
        })
        .tapCatch(() => {
          if (this.mContext !== undefined) {
            // Not sure how we would manage to get here with an undefined
            //  deployment context but it _can_ happen, and it is masking
            //  the actual problem.
            //  https://github.com/Nexus-Mods/Vortex/issues/7069
            this.mContext = undefined;
            context.onComplete();
          }
        })
        .finally(() => {
          this.mDirCache = undefined;
        })
        ;
  }

  public cancel(gameId: string, dataPath: string, installationPath: string) {
    if (this.mContext !== undefined) {
      const context = this.mContext;
      this.mContext = undefined;
      context.onComplete();
    }
    return Promise.resolve();
  }

  public activate(sourcePath: string, sourceName: string, deployPath: string,
                  blackList: Set<string>): Promise<void> {
    return fs.statAsync(sourcePath)
      .then(() => turbowalk(sourcePath, entries => {
        if (this.mContext === undefined) {
          return;
        }
        entries.forEach(entry => {
          const relPath: string = path.relative(sourcePath, entry.filePath);
          const relPathNorm = this.mNormalize(path.join(deployPath, relPath));
          if (!entry.isDirectory && !blackList.has(relPathNorm)) {
            // mods are activated in order of ascending priority so
            // overwriting is fine here
            this.mContext.newDeployment[relPathNorm] = {
              relPath,
              source: sourceName,
              target: deployPath,
              time: entry.mtime * 1000,
            };
          }
        });
      }, { skipHidden: false }))
      .catch({ code: 'ENOTFOUND' }, () => null)
      .catch({ code: 'ENOENT' }, () => null);
  }

  public deactivate(sourcePath: string, dataPath: string, sourceName: string): Promise<void> {
    return turbowalk(sourcePath, entries => {
      if (this.mContext === undefined) {
        return;
      }
      entries.forEach(entry => {
        if (!entry.isDirectory) {
          const relPath: string = path.relative(sourcePath, entry.filePath);
          const normPath = this.mNormalize(path.join(dataPath, relPath));
          if ((this.mContext.newDeployment[normPath] !== undefined)
              && (this.mContext.newDeployment[normPath].source === sourceName)) {
            delete this.mContext.newDeployment[normPath];
          }
        }
      });
    }, { skipHidden: false });
  }

  public prePurge(): Promise<void> {
    return Promise.resolve();
  }

  public purge(installPath: string, dataPath: string, gameId?: string,
               onProgress?: (num: number, total: number) => void): Promise<void> {
    log('debug', 'purging', { installPath, dataPath });
    if (!truthy(dataPath)) {
      // previously we reported an issue here, but we want the ability to have mod types
      // that don't actually deploy
      return Promise.resolve();
    }
    if (gameId === undefined) {
      gameId = activeGameId(this.mApi.store.getState());
    }
    const game = getGame(gameId);
    const directoryCleaning = game.directoryCleaning || 'tag';

    // stat to ensure the target directory exists
    return fs.statAsync(dataPath)
      .then(() => this.purgeLinks(installPath, dataPath, onProgress))
      .then(() => this.postLinkPurge(dataPath, false, true, directoryCleaning))
      .then(() => undefined);
  }

  public postPurge(): Promise<void> {
    return Promise.resolve();
  }

  public getDeployedPath(input: string): string {
    return input;
  }

  public isDeployed(installPath: string, dataPath: string, file: IDeployedFile): Promise<boolean> {
    const fullPath = path.join(dataPath, file.target || '', file.relPath);

    return fs.statAsync(fullPath)
      .then(() => true)
      .catch(() => false);
  }

  public externalChanges(gameId: string,
                         installPath: string,
                         dataPath: string,
                         activation: IDeployedFile[]): Promise<IFileChange[]> {
    const changes: IFileChange[] = [];

    return Promise.map(activation ?? [], fileEntry => {
      const fileDataPath = (truthy(fileEntry.target)
        ? [dataPath, fileEntry.target, fileEntry.relPath]
        : [dataPath, fileEntry.relPath]
        ).join(path.sep);
      const fileModPath = [installPath, fileEntry.source, fileEntry.relPath].join(path.sep);
      let sourceDeleted: boolean = false;
      let destDeleted: boolean = false;
      let sourceTime: Date;
      let destTime: Date;

      let sourceStats: fs.Stats;

      return this.stat(fileModPath)
        .catch(err => {
          // can't stat source, probably the file was deleted.
          // change: we no longer automatically assume the file is deleted because
          // otherwise the dialog will offer the user to delete the file permanently
          // which - if the user isn't careful - would break the mod.
          // The problem is that we now likely can't determine if the link is intact so the
          // entire process may fail but I assume that's still preferrable.
          if (['ENOENT', 'ENOTFOUND'].includes(err.code)) {
            sourceDeleted = true;
          } else {
            log('info', 'source file can\'t be accessed', { fileModPath, error: err.message });
          }
          return Promise.resolve(undefined);
        })
        .then(sourceStatsIn => {
          sourceStats = sourceStatsIn;
          if (sourceStats !== undefined) {
            sourceTime = sourceStats.mtime;
          }
          return this.statLink(fileDataPath);
        })
        .catch(err => {
          // can't stat destination, probably the file was deleted
          if (['ENOENT', 'ENOTFOUND'].includes(err.code)) {
            destDeleted = true;
          } else {
            log('info', 'link can\'t be accessed', { fileModPath, error: err.message });
          }
          return Promise.resolve(undefined);
        })
        .then(destStats => {
          if (destStats !== undefined) {
            destTime = destStats.mtime;
          }
          return sourceDeleted || destDeleted
            ? Promise.resolve(false)
            : this.isLink(fileDataPath, fileModPath, destStats, sourceStats);
        })
        .then((isLink?: boolean) => {
          if (sourceDeleted && !destDeleted && this.canRestore()) {
            changes.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'srcdeleted',
            });
          } else if (destDeleted && !sourceDeleted) {
            changes.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              changeType: 'deleted',
            });
          } else if (!sourceDeleted && !destDeleted && !isLink) {
            changes.push({
              filePath: fileEntry.relPath,
              source: fileEntry.source,
              sourceTime,
              destTime,
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
      }, { concurrency: 200 }).then(() => Promise.resolve(this.deduplicate(changes)));
  }

  /**
   * create file link
   * Note: This function is expected to replace the target file if it exists
   */
  protected abstract linkFile(linkPath: string, sourcePath: string,
                              dirTags?: boolean): Promise<void>;
  protected abstract unlinkFile(linkPath: string, sourcePath: string): Promise<void>;
  protected abstract purgeLinks(installPath: string, dataPath: string,
                                onProgress?: (num: number, total: number) => void): Promise<void>;
  /**
   * test if a file is a link to another file. The stats parameters may not be available,
   * they are just intended as an optimization by avoiding doing redundant calls
   * @param linkPath the path to the presumed link
   * @param sourcePath the path to the source file
   * @param linkStats stats of the link. This was acquired with lstats so
   *                  in case of symlinks this contains info on the link itself
   * @param sourceStats stats of the source file. This was acquired with stats so should
   *                    this be a symlink it *was* followed!
   */
  protected abstract isLink(linkPath: string, sourcePath: string,
                            linkStats?: fs.Stats, sourceStats?: fs.Stats): Promise<boolean>;
  /**
   * must return true if this deployment method is able to restore a file after the
   * "original" was deleted. This is essentially true for hard links (since the file
   * data isn't gone after removing the original) and false for everything else
   */
  protected abstract canRestore(): boolean;

  protected get api(): IExtensionApi {
    return this.mApi;
  }

  protected get normalize(): Normalize {
    return this.mNormalize;
  }

  protected get context(): IDeploymentContext {
    return this.mContext;
  }

  protected stat(filePath: string): Promise<fs.Stats> {
    return fs.statAsync(filePath);
  }

  protected statLink(filePath: string): Promise<fs.Stats> {
    return fs.lstatAsync(filePath);
  }

  protected ensureDir(dirPath: string, dirTags?: boolean): Promise<boolean> {
    let didCreate = false;
    const onDirCreated = (createdPath: string) => {
      didCreate = true;
      if (dirTags !== false) {
        log('debug', 'created directory', createdPath);
        return fs.writeFileAsync(
          path.join(createdPath, LinkingActivator.NEW_TAG_NAME),
            'This directory was created by Vortex deployment and will be removed ' +
            'during purging if it\'s empty');
      } else {
        return Promise.resolve();
      }
    };

    return ((this.mDirCache === undefined) || !this.mDirCache.has(dirPath)
      ? fs.ensureDirAsync(dirPath, onDirCreated).then(() => {
        if (this.mDirCache === undefined) {
          this.mDirCache = new Set<string>();
        }
        this.mDirCache.add(dirPath);
      })
      : Promise.resolve())
      .then(() => didCreate);
  }

  private deduplicate(input: IFileChange[]): IFileChange[] {
    // since the change detection is an asynchronous process, it's possible (though extremely rare)
    // that the same file may show up with different change types. This can cause an error
    // since the same action can not be applied

    const changeMap: { [filePath: string]: IFileChange } = {};

    // if one of the files is deleted that's the more important change, otherwise we
    // take the later one, assuming there is a chronological order to the changes
    const moreImportant = (lhs: IFileChange, rhs: IFileChange) => {
      return !['deleted', 'srcdeleted'].includes(rhs.changeType);
    }

    for (const change of input) {
      if ((changeMap[change.filePath] === undefined)
          || (moreImportant(change, changeMap[change.filePath]))) {
        changeMap[change.filePath] = change;
      }
    }
  
    return Object.values(changeMap);
  }

  private removeDeployedFile(installationPath: string,
                             dataPath: string,
                             key: string,
                             restoreBackup: boolean): Promise<void> {
    if (this.mContext.previousDeployment[key] === undefined) {
      return Promise.reject(new Error(`failed to remove "${key}"`));
    }
    const outputPath = path.join(dataPath,
      this.mContext.previousDeployment[key].target || '',
      this.mContext.previousDeployment[key].relPath);
    const sourcePath = path.join(installationPath,
      this.mContext.previousDeployment[key].source,
      this.mContext.previousDeployment[key].relPath);
    return this.unlinkFile(outputPath, sourcePath)
      .catch(err => (err.code !== 'ENOENT')
        // treat an ENOENT error for the unlink as if it was a success.
        // The end result either way is the link doesn't exist now.
        ? Promise.reject(err)
        : Promise.resolve())
      .then(() => restoreBackup
        ? fs.renameAsync(outputPath + BACKUP_TAG, outputPath).catch(() => undefined)
        : Promise.resolve())
      .then(() => {
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

        return Promise.reject(err);
      });
  }

  private deployFile(key: string, installPathStr: string, dataPath: string,
                     replace: boolean, dirTags: boolean): Promise<IDeployedFile> {
    const fullPath =
      [installPathStr, this.mContext.newDeployment[key].source,
        this.mContext.newDeployment[key].relPath].join(path.sep);
    const fullOutputPath =
      [dataPath, this.mContext.newDeployment[key].target || null,
        this.mContext.newDeployment[key].relPath].filter(i => i !== null).join(path.sep);

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
      .then(() => this.linkFile(fullOutputPath, fullPath, dirTags))
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

  private postLinkPurge(baseDir: string, doRemove: boolean, restoreBackups: boolean,
                        directoryCleaning: DirectoryCleaningMode,
                        reportMissing: boolean = true): Promise<boolean> {
    // recursively go through directories and remove empty ones !if! we encountered a
    // __delete_if_empty file in the hierarchy so far
    let empty = true;
    let queue = Promise.resolve();

    let allEntries: IEntry[] = [];

    const taggedForRemoval = (directoryCleaning === 'all')
      ? () => true
      : (entries: IEntry[]) => entries.find(entry =>
        !entry.isDirectory && LinkingActivator.isTagName(entry.filePath)) !== undefined;

    return Promise.resolve(turbowalk(baseDir, entries => {
      allEntries = allEntries.concat(entries);
    }, { recurse: false, skipHidden: false, skipLinks: false }))
    .then(() => {
      doRemove = doRemove || taggedForRemoval(allEntries);

      const dirs = allEntries.filter(entry => entry.isDirectory);
      // recurse into subdirectories
      queue = queue.then(() =>
        Promise.each(dirs, dir =>
          this.postLinkPurge(dir.filePath, doRemove,
            restoreBackups, directoryCleaning, false)
            .then(removed => {
              if (!removed) { empty = false; }
            }))
        .then(() => {
          // then check files. if there are any, this isn't empty. plus we
          // restore backups here
          const files = allEntries.filter(entry =>
            !entry.isDirectory && !LinkingActivator.isTagName(entry.filePath));
          if (files.length > 0) {
            empty = false;
            return (restoreBackups)
              ? Promise.map(
                  files.filter(entry => path.extname(entry.filePath) === BACKUP_TAG),
                  entry => this.restoreBackup(entry.filePath))
                .catch(UserCanceled, () => undefined)
                .then(() => undefined)
              : Promise.resolve();
          } else {
            return Promise.resolve();
          }
        }));
    })
      .catch((err: Error) => {
        // was only able to reproduce this by removing directory manually while purge was happening
        // still, if the directory doesn't exist, there is nothing to clean up, so - job done?
        if (['ENOTFOUND', 'ENOENT'].includes(err['code'])) {
          if (reportMissing) {
            log('error', 'mod directory not found wrapping up deployment', {
              error: err.message,
              path: baseDir,
            });
          } // otherwise ignore missing files
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => queue)
      .then(() => (empty && doRemove)
          ? fs.statAsync(path.join(baseDir, LinkingActivator.NEW_TAG_NAME))
            .then(() => fs.unlinkAsync(path.join(baseDir, LinkingActivator.NEW_TAG_NAME)))
            .catch(() => fs.unlinkAsync(path.join(baseDir, LinkingActivator.OLD_TAG_NAME)))
            .catch(err =>
              err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
            .then(() => fs.rmdirAsync(baseDir)
              .catch(err => {
                log('error', 'failed to remove directory, it was supposed to be empty', {
                  error: err.message,
                  path: baseDir,
                });
              }))
            .then(() => true)
          : Promise.resolve(false));
  }

  private restoreBackup(backupPath: string) {
    const targetPath = backupPath.substr(0, backupPath.length - BACKUP_TAG.length);
    return fs.renameAsync(backupPath, targetPath)
      // where has it gone? Oh well, doesn't matter. We wouldn't even be trying to restore
      // it if it had been removed a bit earlier
      .catch({ code: 'ENOENT' }, () => null)
      // targetPath exists - user is potentially using another mod manager
      // or has manipulated the files manually - let him decide what to do.
      .catch({ code: 'EEXIST' }, () => {
        return this.mApi.showDialog('question', 'Confirm', {
          text: 'Vortex is attempting to restore the below game file using '
            + 'a backup it generated during a deployment event, but the game '
            + 'file appears to already exist - this usually happens when Vortex '
            + 'is used alongside other mod managers or when the user manipulates '
            + 'the game files manually.\n\n'
            + 'If you choose to restore the Vortex backup, Vortex will erase '
            + 'the existing file and restore the backup; alternatively you can '
            + 'choose to keep the existing file.',
          message: targetPath,
        }, [
            { label: 'Keep Existing File' },
            { label: 'Restore Vortex Backup' },
          ]).then(res => (res.action === 'Restore Vortex Backup')
            ? fs.removeAsync(targetPath)
                .then(() => this.restoreBackup(backupPath))
            : fs.removeAsync(backupPath));
      })
      .catch(UserCanceled, cancelErr => {
        // TODO:
        // this dialog may show up multiple times for the same file because
        // the purge process for different mod types may come across the same directory if
        // the base directory of one is a parent of the base directory of another
        // (say .../Fallout4 and .../Fallout4/data)
        // to fix that we'd have to blacklist directories that are the base of another mod type
        // which would speed this up in general but it feels like a lot can go wrong with that
        return this.mApi.showDialog('question', 'Confirm', {
          text: 'Are you sure you want to cancel? This will leave backup files '
            + 'unrestored, you will have to clean those up manually.',
        }, [
            { label: 'Really cancel' },
            { label: 'Try again' },
          ]).then(res => (res.action === 'Really cancel')
            ? Promise.reject(cancelErr)
            : this.restoreBackup(backupPath));
      });
  }
}

export default LinkingActivator;
