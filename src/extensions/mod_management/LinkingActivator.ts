import {addNotification} from '../../actions/notifications';
import {IExtensionApi} from '../../types/IExtensionContext';
import getNormalizeFunc, {Normalize} from '../../util/getNormalizeFunc';
import {log} from '../../util/log';
import {currentGameMode, installPath} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import walk from '../../util/walk';

import {storeActivation} from './actions/activation';
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

type Activation = { [relPath: string]: IFile };

/**
 * base class for mod activators that use some form of file-based linking
 * (which is probably all of them)
 */
abstract class LinkingActivator implements IModActivator {

  public id: string;
  public name: string;
  public description: string;

  private mNewActivation: Activation = {};
  private mApi: IExtensionApi;
  private mNormalize: Normalize;

  constructor(id: string, name: string, description: string, api: IExtensionApi) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.mApi = api;
  }

  public abstract isSupported(state: any): boolean;

  public prepare(dataPath: string): Promise<void> {
    this.mNewActivation = {};
    return getNormalizeFunc(dataPath)
      .then((func: Normalize) => {
        this.mNormalize = func;
      });
  }

  public finalize(dataPath: string): Promise<void> {
    const state = this.mApi.store.getState();
    const gameId = currentGameMode(state);

    let currentActivation = Object.assign(
        getSafe(state, ['persistent', 'activation', gameId, ''], {}));

    const {added, removed, sourceChanged, contentChanged} =
        this.diffActivation(currentActivation, this.mNewActivation);
    let errorCount: number = 0;

    const installPathStr = installPath(state);

    // unlink all files that were removed or changed
    return Promise.map([].concat(removed, sourceChanged, contentChanged),
                       (key: string) =>
                           this.unlinkFile(
                                   path.join(dataPath, currentActivation[key].relPath))
                               .then(() => delete currentActivation[key])
                               .catch((err) => {
                                 log('warn', 'failed to unlink',
                                     {path: currentActivation[key], error: err.message});
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
        .then(() => {
          // "previousActivation" was updated as we successfully applied changes so it
          // should now represent the actual state on disk whereas this.mCurrentActivation
          // represents the target
          this.mApi.store.dispatch(storeActivation(gameId, '', currentActivation));
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
               let relPath: string = path.relative(sourceBase, iterPath);
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

  public purge(installPath: string, dataPath: string): Promise<void> {
    return this.purgeLinks(installPath, dataPath).then(() => {
      const store = this.mApi.store;
      const gameId = currentGameMode(store.getState());
      store.dispatch(storeActivation(gameId, '', {}));
    });
  }

  public isActive(): boolean {
    return false;
  }

  public externalChanges(installPath: string, dataPath: string): Promise<IFileChange[]> {
    const state = this.mApi.store.getState();
    const gameId = currentGameMode(state);

    let currentActivation = Object.assign(
        getSafe(state, ['persistent', 'activation', gameId, ''], {}));

    let nonLinks: IFileChange[] = [];

    return Promise
        .map(Object.keys(currentActivation),
             (key: string) => {
               const fileDataPath = path.join(dataPath, currentActivation[key].relPath);
               const fileModPath =
                   path.join(installPath, currentActivation[key].source,
                             currentActivation[key].relPath);

               return fs.lstatAsync(fileModPath)
                 .then((stat: fs.Stats): Promise<boolean> => {
                   if (stat.mtime.getTime() !== currentActivation[key].time) {
                     nonLinks.push({
                       filePath: currentActivation[key].relPath,
                       source: currentActivation[key].source,
                       changeType: 'valchange',
                     });
                     return Promise.resolve(undefined);
                   } else {
                    return this.isLink(fileDataPath, fileModPath)
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
                     });
                    })
        .then(() => Promise.resolve(nonLinks));
  }

  protected abstract linkFile(linkPath: string, sourcePath: string): Promise<void>;
  protected abstract unlinkFile(linkPath: string): Promise<void>;
  protected abstract purgeLinks(installPath: string, dataPath: string): Promise<void>;
  protected abstract isLink(linkPath: string, sourcePath: string): Promise<boolean>;

  private diffActivation(before: Activation, after: Activation) {
    let keysBefore = Object.keys(before);
    let keysAfter = Object.keys(after);
    let keysBoth = _.intersection(keysBefore, keysAfter);
    return {
      added: _.difference(keysAfter, keysBefore),
      removed: _.difference(keysBefore, keysAfter),
      sourceChanged: keysBoth.filter((key: string) => before[key].source !== after[key].source),
      contentChanged: keysBoth.filter((key: string) => before[key].time !== after[key].time),
    };
  }
}

export default LinkingActivator;
