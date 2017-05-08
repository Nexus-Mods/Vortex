import {addNotification} from '../../actions/notifications';
import {IExtensionApi} from '../../types/IExtensionContext';
import getNormalizeFunc, {Normalize} from '../../util/getNormalizeFunc';
import {log} from '../../util/log';
import {activeGameId, installPath} from '../../util/selectors';
import {loadData, saveData} from '../../util/storage';
import walk from '../../util/walk';

import {IMod} from './types/IMod';
import {IFileChange, IModActivator} from './types/IModActivator';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';

interface IFile {
  relPath: string;
  source: string;
  // content changes are discovered based on changes to the modified date.
  // using a hash would be more reliable but faaar more expensive performance-
  // wise
  time: number;
}

interface IActivation {
  [relPath: string]: IFile;
}

/**
 * base class for mod activators that use some form of file-based linking
 * (which is probably all of them)
 */
abstract class LinkingActivator implements IModActivator {

  public id: string;
  public name: string;
  public description: string;

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

  public prepare(dataPath: string, clean: boolean): Promise<void> {
    return getNormalizeFunc(dataPath)
      .then((func: Normalize) => {
        this.mNormalize = func;
        if (clean) {
          this.mNewActivation = {};
        } else {
          const state = this.mApi.store.getState();
          const gameId = activeGameId(state);
          return loadData(gameId, 'activation', {})
          .then((activation) => {
            return this.mNewActivation = activation;
          });
        }
      });
  }

  public finalize(dataPath: string): Promise<void> {
    const state = this.mApi.store.getState();
    const gameId = activeGameId(state);

    let currentActivation: any;
    let added: string[];
    let removed: string[];
    let sourceChanged: string[];
    let contentChanged: string[];

    let errorCount: number = 0;

    const installPathStr = installPath(state);

    // unlink all files that were removed or changed
    return loadData(gameId, 'activation', {})
      .then((currentActivationIn: any) => {
        currentActivation = currentActivationIn;
        ({ added, removed, sourceChanged, contentChanged } =
          this.diffActivation(currentActivation, this.mNewActivation));
        return Promise.map([].concat(removed, sourceChanged, contentChanged),
          (key: string) =>
            this.unlinkFile(
              path.join(dataPath, currentActivation[key].relPath))
              .then(() => delete currentActivation[key])
              .catch((err) => {
                log('warn', 'failed to unlink',
                  { path: currentActivation[key], error: err.message });
                ++errorCount;
              }));
      })
        // then, (re-)link all files that were added or changed
      .then(() => Promise.map(
        [].concat(added, sourceChanged, contentChanged),
        (key: string) => {
          const fullPath = path.join(
            installPathStr, this.mNewActivation[key].source,
            this.mNewActivation[key].relPath);
          return this.linkFile(
            path.join(dataPath, this.mNewActivation[key].relPath),
            fullPath)
            .then(() => currentActivation[key] =
              this.mNewActivation[key])
            .catch((err) => {
              log('warn', 'failed to link', {
                link: this.mNewActivation[key].relPath,
                source: this.mNewActivation[key].source,
                error: err.message,
              });
              ++errorCount;
            });
        }))
        .then(() => saveData(gameId, 'activation', currentActivation))
        .then(() => {
          if (errorCount > 0) {
            addNotification({
              type: 'error',
              title: this.mApi.translate('Activation failed'),
              message: this.mApi.translate(
                  '{{count}} files were not correctly activated (see log for details)',
                  {replace: {count: errorCount}}),
            });
          }
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
           }).then(() => undefined);
  }

  public purge(installPath: string, dataPath: string): Promise<void> {
    return this.purgeLinks(installPath, dataPath).then(() => {
      const store = this.mApi.store;
      const gameId = activeGameId(store.getState());
      return saveData(gameId, 'activation', {});
    });
  }

  public isActive(): boolean {
    return false;
  }

  public externalChanges(installPath: string, dataPath: string): Promise<IFileChange[]> {
    const state = this.mApi.store.getState();
    const gameId = activeGameId(state);

    let currentActivation: any;

    const nonLinks: IFileChange[] = [];

    return loadData(gameId, 'activation', {})
      .then((activation: any) => {
        currentActivation = activation;
        // test if the file mentioned in the activation manifest is still a link
        return Promise
          .map(Object.keys(currentActivation),
          (key: string) => {
            const fileDataPath = path.join(dataPath, currentActivation[key].relPath);
            const fileModPath =
              path.join(installPath, currentActivation[key].source,
                currentActivation[key].relPath);
            return fs.statAsync(fileDataPath)
              .then((stat: fs.Stats): Promise<boolean> => {
                if (stat.mtime.getTime() !== currentActivation[key].time) {
                  nonLinks.push({
                    filePath: currentActivation[key].relPath,
                    source: currentActivation[key].source,
                    changeType: 'valchange',
                  });
                  return Promise.resolve(undefined);
                } else {
                  return this.isLink(fileDataPath, fileModPath);
                }
              })
              .then((isLink?: boolean) => {
                if ((isLink !== undefined) && !isLink) {
                  nonLinks.push({
                    filePath: currentActivation[key].relPath,
                    source: currentActivation[key].source,
                    changeType: 'refchange',
                  });
                }
              })
              .catch((err) => {
                // can't stat, probably the file was deleted
                nonLinks.push({
                  filePath: currentActivation[key].relPath,
                  source: currentActivation[key].source,
                  changeType: 'deleted',
                });
              })
              ;
          });
      })
      .then(() => Promise.resolve(nonLinks));
  }

  public forgetFiles(filePaths: string[]): Promise<void> {
    const state = this.mApi.store.getState();
    const gameId = activeGameId(state);
    return loadData(gameId, 'activation', {})
      .then((activation: any) => {
        filePaths.forEach((path: string) => {
          delete activation[path.toUpperCase()];
        });
        return saveData(gameId, 'activation', activation);
      });
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
}

export default LinkingActivator;
