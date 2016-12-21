import {setPluginOrder} from './actions/loadOrder';
import {setLootActivity} from './actions/plugins';
import {IPluginLoot, IPluginsLoot} from './types/IPlugins';
import {lootAppPath, pluginPath} from './util/gameSupport';

import * as Promise from 'bluebird';
import {GameId, LootDatabase} from 'loot';
import {types, util} from 'nmm-api';
import * as path from 'path';

class LootInterface {
  private mLoot: LootDatabase;
  private mLootQueue: Promise<void>;
  private mOnSetLootActivity: (activity: string) => void;
  private mExtensionApi: types.IExtensionApi;
  private mOnFirstInit: () => void;

  constructor(context: types.IExtensionContext) {
    let store = context.api.store;

    this.mLootQueue = new Promise<void>((resolve, reject) => this.mOnFirstInit = resolve);

    this.mExtensionApi = context.api;

    // when the game changes, we need to re-initialize loot for that game
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      let gamePath: string = util.currentGameDiscovery(store.getState()).path;
      this.init(gameMode as GameId, gamePath);
    });

    // on demand, re-sort the plugin list
    context.api.events.on('autosort-plugins', () => {
      if (store.getState().settings.plugins.autoSort) {
        const t = this.mExtensionApi.translate;
        this.enqueue(t('Sorting plugins'), () => {
          let pluginNames: string[] = Object.keys(store.getState().loadOrder);
          let sorted: string[] = this.mLoot.sortPlugins(pluginNames);
          store.dispatch(setPluginOrder(sorted));
          return Promise.resolve();
        });
      }
      return Promise.resolve();
    });

    context.api.events.on('plugin-details', this.pluginDetails);

    this.mOnSetLootActivity = (activity: string) => store.dispatch(setLootActivity(activity));
  }

  private pluginDetails =
      (plugins: string[], callback: (result: IPluginsLoot) => void) => {
        const t = this.mExtensionApi.translate;
        this.enqueue(t('Reading Plugin Details'), () => {
          let result: IPluginsLoot = {};
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

  private init(gameMode: GameId, gamePath: string) {
    const t = this.mExtensionApi.translate;

    this.mLoot = new LootDatabase(gameMode, gamePath, pluginPath(gameMode));

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
      const updateAsync =
          Promise.promisify(this.mLoot.updateMasterlist, {context: this.mLoot});
      return updateAsync(masterlistPath,
                         `https://github.com/loot/${gameMode}.git`, 'v0.10')
          .then(() => undefined);
    });
    this.enqueue(t('Load Lists'), () => {
      const loadListsAsync =
          Promise.promisify(this.mLoot.loadLists, {context: this.mLoot});
      return loadListsAsync(masterlistPath, '');
    });
    this.enqueue(t('Eval Lists'), () => {
      const evalListsAsync =
          Promise.promisify(this.mLoot.evalLists, {context: this.mLoot});
      return evalListsAsync();
    });
    if (preInitQueue) {
      // there were tasks enqueued before the game mode was activated. Now we can run them.
      // enqueue a new promise that resolves once those pre-init tasks are done and unblock them.
      this.enqueue(t('Init Queue'), () => {
        this.mOnFirstInit();
        this.mOnFirstInit = null;
        return new Promise<void>((resolve, reject) => {
          preInitQueue.then(() => resolve());
        });
      });
    }
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
