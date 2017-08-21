import {setPluginOrder} from './actions/loadOrder';
import {setLootActivity} from './actions/plugins';
import {IPluginsLoot} from './types/IPlugins';
import {gameSupported, lootAppPath, pluginPath} from './util/gameSupport';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import {GameId, LootDatabase} from 'loot';
import * as path from 'path';
import {log, selectors, types} from 'vortex-api';

class LootInterface {
  private mLoot: LootDatabase;
  private mLootGame: string;
  private mLootQueue: Promise<void>;
  private mOnSetLootActivity: (activity: string) => void;
  private mExtensionApi: types.IExtensionApi;
  private mOnFirstInit: () => void;

  private mUserlistTime: Date;

  private sortAsync;
  private loadListsAsync;
  private updateAsync;
  private evalListsAsync;

  constructor(context: types.IExtensionContext) {
    const store = context.api.store;

    this.mLootQueue = new Promise<void>((resolve, reject) => {
      this.mOnFirstInit = () => {
        resolve();
      };
    });

    this.mExtensionApi = context.api;

    // when the game changes, we need to re-initialize loot for that game
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const gamePath: string = selectors.currentGameDiscovery(store.getState()).path;
      if (gameSupported(gameMode)) {
        this.init(gameMode as GameId, gamePath)
          .catch(err => {
            context.api.showErrorNotification('Failed to initialize LOOT', err);
            this.mLoot = undefined;
          });
      } else {
        this.mLoot = undefined;
      }
    });

    // on demand, re-sort the plugin list
    context.api.events.on('autosort-plugins', () => {
      if (store.getState().settings.plugins.autoSort && (this.mLoot !== undefined)) {
        const t = this.mExtensionApi.translate;
        const state = store.getState();
        const gameMode = selectors.activeGameId(state);
        if (!gameSupported(gameMode)) {
          return;
        }
        this.readLists(gameMode as GameId);
        const id = require('shortid').generate();
        this.enqueue(t('Sorting plugins'), () => {
          if (gameMode !== this.mLootGame) {
            // game mode has been switched
            return Promise.resolve();
          }
          let pluginNames: string[] = Object.keys(state.loadOrder);
          pluginNames = pluginNames.filter((name: string) =>
            state.session.plugins.pluginList[name] !== undefined,
          );
          return this.sortAsync(pluginNames)
            .then((sorted: string[]) => {
              store.dispatch(setPluginOrder(sorted));
            });
        });
      }
      return Promise.resolve();
    });

    context.api.events.on('plugin-details', this.pluginDetails);

    this.mOnSetLootActivity = (activity: string) => store.dispatch(setLootActivity(activity));
  }

  public wait(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.mOnFirstInit !== null) {
        // if the first initialisation hasn't happened yet there is no queue to wait on
        return resolve();
      }
      this.enqueue('', () => {
        resolve();
        return Promise.resolve();
      });
    });
  }

  private pluginDetails =
      (plugins: string[], callback: (result: IPluginsLoot) => void) => {
        if (this.mLoot === undefined) {
          return;
        }
        const t = this.mExtensionApi.translate;
        this.enqueue(t('Reading Plugin Details'), () => {
          const result: IPluginsLoot = {};
          plugins.forEach((pluginName: string) => {
            result[pluginName] = {
              messages: this.mLoot.getPluginMessages(pluginName, 'en'),
              tags: this.mLoot.getPluginTags(pluginName),
              cleanliness: this.mLoot.getPluginCleanliness(pluginName),
            };
          });
          callback(result);
          return Promise.resolve();
        });
      }

  private readLists(gameMode: GameId) {
    const t = this.mExtensionApi.translate;

    const masterlistPath = path.join(lootAppPath(gameMode), 'masterlist.yaml');
    const userlistPath = path.join(remote.app.getPath('userData'), gameMode, 'userlist.yaml');

    this.enqueue(t('Load Lists'), () => {
      return fs.statAsync(userlistPath)
        .then((stat: fs.Stats) => {
          return Promise.resolve(stat.mtime);
        })
        .catch(() => Promise.resolve(null))
        .then(mtime => {
          // load & evaluate lists first time we need them and whenever
          // the userlist has changed
          if ((this.mUserlistTime === undefined) || (this.mUserlistTime !== mtime)) {
            log('info', '(re-)loading loot lists');
            return this.loadListsAsync(masterlistPath, mtime !== null ? userlistPath : '')
              .then(() => this.evalListsAsync())
              .then(() => this.mUserlistTime = mtime);
          } else {
            return Promise.resolve();
          }
        })
        ;
    });
  }

  private init(gameMode: GameId, gamePath: string): Promise<void> {
    const t = this.mExtensionApi.translate;
    const localPath = pluginPath(gameMode);
    return fs.ensureDirAsync(localPath)
      .then(() => {
        this.mLoot = new LootDatabase(gameMode, gamePath, localPath);
        this.mLootGame = gameMode;
        this.promisify();

        // little bit of hackery: If tasks are queued before the game mode is activated
        // we assume they are intended for the first active game mode.
        // In that case those tasks were blocked behind a promise that resolves on the
        // mOnFirstInit call. But we have to do our initialisation first!
        let preInitQueue: Promise<void>;
        if (this.mOnFirstInit !== null) {
          preInitQueue = this.mLootQueue;
          this.mLootQueue = Promise.resolve();
        }

        const masterlistPath = path.join(lootAppPath(gameMode), 'masterlist.yaml');
        this.enqueue(t('Update Masterlist'), () => {
          return fs.ensureDirAsync(path.dirname(masterlistPath))
            .then(() =>
              this.updateAsync(masterlistPath,
                `https://github.com/loot/${gameMode}.git`,
                'v0.10')
                .catch(err => {
                  this.mExtensionApi.showErrorNotification(
                    'failed to update masterlist', err);
                }));
        });
        this.readLists(gameMode);
        if (preInitQueue) {
          // there were tasks enqueued before the game mode was activated. Now we can run them.
          // enqueue a new promise that resolves once those pre-init tasks are done and unblock
          // them.
          this.enqueue(t('Init Queue'), () => {
            this.mOnFirstInit();
            this.mOnFirstInit = null;
            return new Promise<void>((resolve, reject) => {
              preInitQueue.then(() => resolve());
            });
          });
        }
      });
  }

  private promisify() {
    this.sortAsync = Promise.promisify(this.mLoot.sortPlugins,
      { context: this.mLoot });
    this.loadListsAsync =
      Promise.promisify(this.mLoot.loadLists, { context: this.mLoot });
    this.updateAsync = Promise.promisify(this.mLoot.updateMasterlist,
      { context: this.mLoot });
    this.evalListsAsync =
      Promise.promisify(this.mLoot.evalLists, { context: this.mLoot });
  }

  private enqueue(description: string, step: () => Promise<void>) {
    this.mLootQueue = this.mLootQueue.then(() => {
      this.mOnSetLootActivity(description);
      return step()
      .catch((err: Error) => {
        this.mExtensionApi.showErrorNotification('LOOT operation failed', err);
      })
      .finally(() => {
        this.mOnSetLootActivity('');
      });
    });
  }
}

export default LootInterface;
