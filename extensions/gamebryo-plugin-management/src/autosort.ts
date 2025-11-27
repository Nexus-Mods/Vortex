/* eslint-disable */
import {updatePluginOrder} from './actions/loadOrder';
import { removeGroupRule, removeRule, setGroup } from './actions/userlist';
import {IPluginLoot, IPlugins, IPluginsLoot} from './types/IPlugins';
import { gameDataPath, gameSupported, nativePlugins, pluginPath } from './util/gameSupport';
import { downloadMasterlist, downloadPrelude } from './util/masterlist';

import { GHOST_EXT, NAMESPACE } from './statics';

import Bluebird from 'bluebird';
import getVersion from 'exe-version';
import i18next from 'i18next';
import { LootAsync, Message, PluginMetadata } from 'loot';
import * as path from 'path';
import {} from 'redux-thunk';
import {actions, fs, log, selectors, types, util} from 'vortex-api';
import { pl } from 'date-fns/locale';

const MAX_RESTARTS = 3;

const LootProm: any = Bluebird.promisifyAll(LootAsync);

enum EdgeType {
  userGroup = 'userGroup',
  masterlistGroup = 'masterlistGroup',
  hardcoded = 'hardcoded',
  master = 'master',
  masterFlag = 'masterFlag',
  masterlistLoadAfter = 'masterlistLoadAfter',
  masterlistRequirement = 'masterlistRequirement',
  userLoadAfter = 'userlistLoadAfter',
  userRequirement = 'userlistRequirement',
  assetOverlap = 'assetOverlap',
  recordOverlap = 'recordOverlap',
  tieBreak = 'tieBreak',
}

interface ICycleEdge {
  name: string;
  typeOfEdgeToNextVertex: EdgeType;
}

class LootInterface {
  private mExtensionApi: types.IExtensionApi;
  private mInitPromise: Bluebird<{ game: string, loot: typeof LootProm }> =
    Bluebird.resolve({ game: undefined, loot: undefined });
  private mSortPromise: Bluebird<string[]> = Bluebird.resolve([]);

  private mUserlistTime: Date;
  private mRestarts: number = MAX_RESTARTS;

  constructor(api: types.IExtensionApi) {
    const store = api.store;

    this.mExtensionApi = api;

    // when the game changes, we need to re-initialize loot for that game
    api.events.on('gamemode-activated',
      gameMode => this.onGameModeChanged(api, gameMode));

    { // in case the initial gamemode-activated event was already sent,
      // initialize right away
      const gameMode = selectors.activeGameId(store.getState());
      if (gameMode) {
        this.onGameModeChanged(api, gameMode);
      }
    }

    api.events.on('restart-helpers', async () => {
      const { game, loot } = await this.mInitPromise;
      const gameMode = selectors.activeGameId(store.getState());
      this.startStopLoot(api, gameMode, loot);
    });

    // on demand, re-sort the plugin list
    api.events.on('autosort-plugins', this.onSort);

    api.events.on('plugin-details',
      (gameId: string, plugins: string[], callback: (result: IPluginsLoot) => void) =>
        this.pluginDetails(api, gameId, plugins, callback));
  }

  public async downloadMasterlist(gameMode: string): Promise<void> {
    const masterlistRepoPath = path.join(util.getVortexPath('userData'), gameMode, 'masterlist');
    const masterlistPath = path.join(masterlistRepoPath, 'masterlist.yaml');
    const preludePath = path.join(util.getVortexPath('userData'), 'loot_prelude', 'prelude.yaml');
    try {
      await downloadPrelude(preludePath);
      await downloadMasterlist(this.convertGameId(gameMode, true), masterlistPath);
      log('info', 'updated loot masterlist');
      this.mExtensionApi.events.emit('did-update-masterlist');
    } catch (err) {
      const t = this.mExtensionApi.translate;
      this.mExtensionApi.showErrorNotification('Failed to update masterlist', {
        message: t('This might be a temporary network error. '
              + 'If it persists, please delete "{{masterlistPath}}" to force Vortex to '
              + 'download a new copy.', { replace: { masterlistPath: masterlistRepoPath } }),
        error: err,
      }, {
          allowReport: false,
        });
    }
  }

  public async wait(): Promise<void> {
    try {
      await this.mInitPromise;
      await this.mSortPromise;
    } catch (err) {
      // nop
    }
  }

  private shouldDeferLootActivities = () => {
    const state = this.mExtensionApi.store.getState();
    const deferOnActivities = ['installing_dependencies'];
    const isActivityRunning = (activity: string) => util.getSafe(state, ['session', 'base', 'activity', activity], []).length > 0;
    const deferActivities = deferOnActivities.filter(activity => isActivityRunning(activity));
    return deferActivities.length > 0;
  }

  private onSort = async (manual: boolean, callback?: (err: Error) => void) => {
    const { store } = this.mExtensionApi;
    try {
      if (this.shouldDeferLootActivities()) {
        // Defer - the plugins will be sorted once the activity is done
        if (callback !== undefined) {
          callback(null);
        }
        return Promise.resolve();
      }
      if (manual || store.getState().settings.plugins.autoSort) {
        // ensure initialisation is done
        const { game, loot } = await this.mInitPromise;

        const gameMode = selectors.activeGameId(store.getState());
        if ((gameMode !== game)
            || (!gameSupported(gameMode, true))) {
          return;
        }

        if  ((loot === undefined)
            || loot.isClosed()) {
          if (callback !== undefined) {
            callback(new Error('LOOT is uninitialized/closed'));
          }
          return;
        }

        // ensure no other sort is in progress
        try {
          await this.mSortPromise;
        // tslint:disable-next-line:no-empty
        } catch (err) {}

        // work with up-to-date state
        const state = store.getState();

        const pluginList: IPlugins = state.session.plugins.pluginList;

        const lo = (pluginKey: string) =>
          (state.loadOrder[pluginKey] || { loadOrder: -1 }).loadOrder;

        const isValid = (pluginKey: string) => {
          const isDeployed = pluginList[pluginKey]?.deployed || false;
          const isGhost = pluginList[pluginKey]?.filePath && path.extname(pluginList[pluginKey]?.filePath) === GHOST_EXT;
          const isNative = pluginList[pluginKey]?.isNative || false;
          return (isDeployed && !isGhost) || isNative;
        }

        let pluginIds: string[] = Object
          // from all plugins
          .keys(pluginList)
          .filter((pluginId: string) => isValid(pluginId))
          // apply existing ordering (as far as available)
          .sort((lhs, rhs) => lo(lhs) - lo(rhs));

        // make sure we only pass files to loot that really exist on disk (and are accessible)
        // this should be a waste of time, pluginList should already only contain files
        // that are really there but loot produces really annoying error messages so I want to
        // be sure.
        pluginIds = await Bluebird.filter(pluginIds, pluginId =>
          fs.statAsync(pluginList[pluginId].filePath).then(() => true).catch(() => false));

        const pluginNames = pluginIds
          .map((pluginId: string) => path.basename(pluginList[pluginId].filePath));

        await this.doSort(pluginNames, gameMode, loot);
      }
      if (callback !== undefined) {
        callback(null);
      }
      this.mExtensionApi.sendNotification({
        id: 'loot-sorted',
        type: 'success',
        message: 'LOOT sorting successful',
        displayMS: 3000,
      });
      return Promise.resolve();
    } catch (err) {
      if (callback !== undefined) {
        callback(err);
      }
    }
  }

  private get gamePath() {
    const { store } = this.mExtensionApi;
    const discovery = selectors.currentGameDiscovery(store.getState());
    if (discovery === undefined) {
      // no game selected
      return undefined;
    }
    return discovery.path;
  }

  private get dataPath() {
    const { store } = this.mExtensionApi;
    const activeGameId = selectors.activeGameId(store.getState());
    const discovery = selectors.discoveryByGame(store.getState(), activeGameId);
    if (!discovery?.path) {
      // no game selected
      return undefined;
    }

    return gameDataPath(activeGameId);
  }

  private async doSort(pluginNames: string[], gameMode: string, loot: typeof LootProm) {
    const { store } = this.mExtensionApi;
    try {
      this.mExtensionApi.dismissNotification('loot-cycle-warning');
      const timeBefore = Date.now();
      store.dispatch(actions.startActivity('plugins', 'sorting'));
      this.mSortPromise = this.readLists(gameMode, loot)
        .then(() => loot.sortPluginsAsync(pluginNames))
        .catch(err => (err.message.toLowerCase() === 'already closed')
          ? Promise.resolve([])
          : Promise.reject(err));
      const sorted: string[] = await this.mSortPromise;
      this.mRestarts = MAX_RESTARTS;
      const state = store.getState();
      if (sorted !== undefined) {
        store.dispatch(updatePluginOrder(sorted, false, state.settings.plugins.autoEnable));
        log('debug', 'sorting plugins finished', { elapsedMS: Date.now() - timeBefore });
      } else {
        // loot didn't return an error but an undefined result. Reviewing the code it doesn't
        // seem to be an error on our end, don't have a clue how to even investigate further.
        // It's also ultra rare so probably not worth the time
        log('error', 'failed to sort plugins, empty loot result');
      }
    } catch (err) {
      log('info', 'loot failed', { error: err.message });
      if (err.message.startsWith('Cyclic interaction')) {
        this.reportCycle(err, loot);
      } else if (err.message.endsWith('is not a valid plugin')) {
        const pluginName = err.message.replace(/"([^"]*)" is not a valid plugin/, '$1');
        const reportErr = () => {
          this.mExtensionApi.sendNotification({
            id: 'loot-failed',
            type: 'warning',
            message: this.mExtensionApi.translate('Plugins not sorted because: {{msg}}',
              { replace: { msg: err.message }, ns: NAMESPACE }),
          });
        };
        try {
          // You just can't sort with invalid plugins that are present in the 
          //  data folder.
          await fs.statAsync(path.join(this.dataPath, pluginName));
          reportErr();
        } catch (fsErr) {
          const idx = pluginNames.indexOf(pluginName);
          if (idx !== -1) {
            const newList = pluginNames.slice();
            newList.splice(idx, 1);
            return this.doSort(newList, gameMode, loot);
          }
        }
      } else if (err.message.match(/The group "[^"]*" does not exist/)) {
        this.mExtensionApi.sendNotification({
          id: 'loot-failed',
          type: 'warning',
          message: this.mExtensionApi.translate('Plugins not sorted because: {{msg}}',
            { replace: { msg: err.message }, ns: NAMESPACE }),
        });
      } else if (err.message.indexOf('Failed to evaluate condition') !== -1) {
        const match = err.message.match(
          /Failed to evaluate condition ".*version\("([^"]*\.exe)",.*/);
        if (match) {
          let exists = false;
          let fileSize = 0;
          let md5sum = '';
          let version = '';
          const filePath = path.resolve(this.dataPath, match[1]);

          const report = () => {
            err.message +=
              '\n\nThis error is usually caused by pirated copies of the game. '
              + 'If this is definitively not the case for you (and only then!), '
              + 'please report it.';
            this.mExtensionApi.showErrorNotification('LOOT operation failed', {
              error: err,
              File: filePath,
              Exists: exists,
              Size: fileSize,
              MD5: md5sum,
              Version: version,
            }, {
                id: 'loot-failed',
                allowReport: false,
              });
          };

          try {
            const stats = fs.statSync(filePath);
            exists = true;
            fileSize = stats.size;
            version = getVersion(filePath) || 'unknown';
            (util as any).fileMD5(filePath)
              .then(hash => md5sum = hash)
              .catch(() => null)
              .finally(() => {
                report();
              });
          } catch (err) {
            report();
          }
        } else {
          this.mExtensionApi.showErrorNotification('LOOT operation failed', err, {
            id: 'loot-failed',
            allowReport: false,
          });
        }
      } else if (err.message.toLowerCase() === 'already closed') {
        // loot process terminated, don't really care about the result anyway
      } else if (err.name === 'RemoteDied') {
        this.mExtensionApi.showErrorNotification('LOOT process died', err, {
          allowReport: false,
        });
      } else {
        this.mExtensionApi.showErrorNotification('LOOT operation failed', err, {
          id: 'loot-failed',
          allowReport: false,
        });
      }
    } finally {
      store.dispatch(actions.stopActivity('plugins', 'sorting'));
    }
  }

  private onGameModeChanged = async (api: types.IExtensionApi, gameMode: string) => {
    const oldInitProm = this.mInitPromise;

    let onRes: (x: { game: string, loot: LootAsync }) => void;

    this.mInitPromise = new Bluebird<{ game: string, loot: LootAsync }>((resolve) => {
      onRes = resolve;
    });

    const { game, loot }: { game: string, loot: LootAsync } = await oldInitProm;
    if (gameMode === game) {
      this.mInitPromise = oldInitProm;
      onRes({ game, loot });
      // no change
      return;
    } else {
      this.startStopLoot(api, gameMode, loot);
      onRes(await this.mInitPromise);
    }
  }

  private startStopLoot(api: types.IExtensionApi, gameMode: string, loot: LootAsync) {
    if (loot !== undefined) {
      // close the loot instance of the old game, but give it a little time, otherwise it may try to
      // to run instructions after being closed.
      // TODO: Would be nice if this was deterministic...
      setTimeout(() => {
        loot.close();
      }, 5000);
    }
    const gamePath = this.gamePath;
    if (gameSupported(gameMode, true)) {
      try {
        this.mInitPromise = this.init(gameMode);
      } catch (err) {
        api.showErrorNotification('Failed to initialize LOOT', {
          error: err,
          Game: gameMode,
          Path: gamePath,
        });
        this.mInitPromise = Bluebird.resolve({ game: gameMode, loot: undefined });
      }
    } else {
      this.mInitPromise = Bluebird.resolve({ game: gameMode, loot: undefined });
    }
  }

  private async getLoot(api: types.IExtensionApi, gameId: string):
        Promise<{ game: string, loot: typeof LootProm }> {
    let res = await this.mInitPromise;
    if (res.game !== gameId) {
      this.onGameModeChanged(api, gameId);
      res = await this.mInitPromise;
    }
    return res;
  }

  private pluginDetails = async (api: types.IExtensionApi, gameId: string,
                                 plugins: string[], cb: (result: IPluginsLoot) => void) => {
    const callback = (res: IPluginsLoot)  => {
      api.events.emit('trigger-test-run', 'loot-info-updated');
      cb(res);
    };
    if (this.shouldDeferLootActivities()) {
      // Defer - the plugins will be updated once the activity is done
      callback({});
      return;
    }

    const { game, loot } = await this.getLoot(api, gameId);
    if ((loot === undefined) || loot.isClosed()) {
      callback({});
      return;
    }
    
    log('debug', 'requesting plugin info', plugins);
    try {
      // not really interested in these messages but apparently it's the only way to make the api
      // drop its cache of _all_ previously evaluated conditions
      await loot.getGeneralMessagesAsync(true);
      if (loot.isClosed()) {
        callback({});
        return;
      }
      await loot.loadCurrentLoadOrderStateAsync();
    } catch (err) {
      this.mExtensionApi.showErrorNotification(
        'There were errors getting plugin information from LOOT',
        err, { allowReport: false, id: 'gamebryo-plugins-loot-meta-error' });
      callback({});
      return;
    }

    const result: IPluginsLoot = {};
    let error: Error;
    let pluginsLoaded = false;
    const state = this.mExtensionApi.store.getState();
    const pluginList: IPlugins = state.session.plugins.pluginList;

    try {
      await loot.loadPluginsAsync(plugins
        .filter(id => (pluginList[id] !== undefined) && pluginList[id].deployed)
        .map(name => name.toLowerCase()), false);
      pluginsLoaded = true;
    } catch (err) {
      if (err.message.toLowerCase() === 'already closed') {
        return;
      }

      this.mExtensionApi.showErrorNotification('Failed to parse plugins',
                                               err, {
                                                 allowReport: false,
                                                 id: `loot-failed-to-parse`,
                                               });
    }

    const createEmpty = (): IPluginLoot => ({
      messages: [],
      currentTags: [],
      suggestedTags: [],
      cleanliness: [],
      dirtyness: [],
      group: undefined,
      isValidAsLightPlugin: false,
      loadsArchive: false,
      incompatibilities: [],
      requirements: [],
      version: '',
    });

    let closed = loot.isClosed();
    await Promise.all(plugins.map(async (pluginName: string) => {
      if (closed) {
        result[pluginName] = createEmpty();
        return;
      }
      try {
        const meta: PluginMetadata = await loot.getPluginMetadataAsync(pluginName);
        let info;
        try {
          const id = pluginName.toLowerCase();
          if ((pluginList[id] !== undefined) && pluginList[id].deployed) {
            info = await loot.getPluginAsync(pluginName);
          }
        } catch (err) {
          const gameMode = selectors.activeGameId(this.mExtensionApi.store.getState());
          log('error', 'failed to get plugin info',
              { pluginName, error: err.message, gameMode, gameId });
        }

        const toRef = iter => ({ name: iter.name, display: iter.displayName });

        const missingMetaMessage = 'No LOOT metadata could be found for this plugin. This is usually fine, but you may have to assign it a different Group to help LOOT sort it correctly.';
        const lootMessage: Message = {
          type: -1,
          content: missingMetaMessage,
          condition: 'always',
        }
        result[pluginName] = {
          messages: !meta && !nativePlugins(gameId).includes(pluginName) ? [lootMessage] : meta?.messages || [],
          currentTags: info?.bashTags?.filter?.(tag => !!tag) || [],
          suggestedTags: meta?.tags?.filter?.(tag => !!tag) || [],
          cleanliness: meta?.cleanInfo || [],
          dirtyness: meta?.dirtyInfo || [],
          group: meta?.group || '',
          requirements: (meta?.requirements || []).map(toRef),
          incompatibilities: (meta?.incompatibilities || []).map(toRef),
          isValidAsLightPlugin: pluginsLoaded && (info !== undefined) && info.isValidAsLightPlugin,
          loadsArchive: pluginsLoaded && (info !== undefined) && info.loadsArchive,
          version: (pluginsLoaded && (info !== undefined)) ? info.version : '',
        };
      } catch (err) {
        result[pluginName] = createEmpty();
        if (err.arg !== undefined) {
          // invalid parameter. This simply means that loot has no meta data for this plugin
          // so that's not a problem
        } else {
          if (err.message.toLowerCase() === 'already closed') {
            closed = true;
            return;
          }
          log('error', 'Failed to get plugin meta data from loot',
            { pluginName, error: err.message });
          error = err;
        }
      }
    }))
    .then(() => {
      if ((error !== undefined) && !closed) {
        this.mExtensionApi.showErrorNotification(
          'There were errors getting plugin information from LOOT',
          error, { allowReport: false, id: 'gamebryo-plugins-loot-details-error' });
      }
      callback(result);
    });
  }

  public loadLists = async (gameMode: string, loot: typeof LootProm) => {
    const masterlistPath = path.join(util.getVortexPath('userData'), gameMode, 'masterlist', 'masterlist.yaml');
    const userlistPath = path.join(util.getVortexPath('userData'), gameMode, 'userlist.yaml');
    const preludePath = path.join(util.getVortexPath('userData'), 'loot_prelude', 'prelude.yaml');

    let mtime: Date;
    try {
      mtime = (await fs.statAsync(userlistPath)).mtime;
    } catch (err) {
      mtime = null;
    }

    let usePrelude: boolean = false;
    try {
      await fs.statAsync(preludePath);
      usePrelude = true;
    } catch (err) {
      // nop
    }

    // load & evaluate lists first time we need them and whenever
    // the userlist has changed
    if ((mtime !== null) &&
        // this.mUserlistTime could be undefined or null
        (!this.mUserlistTime ||
         (this.mUserlistTime.getTime() !== mtime.getTime()))) {
      log('info', '(re-)loading loot lists', {
        mtime,
        masterlistPath,
        userlistPath,
        last: this.mUserlistTime,
      });
      try {
        await fs.statAsync(masterlistPath);
        await loot.loadListsAsync(
          masterlistPath,
          mtime !== null ? userlistPath : '',
          usePrelude ? preludePath : '');
        log('info', 'loaded loot lists');
        this.mUserlistTime = mtime;
      } catch (err) {
        this.mExtensionApi.showErrorNotification('Failed to load master-/userlist', err, {
            allowReport: false,
          } as any);
      }
    }
  }

  // tslint:disable-next-line:member-ordering
  private readLists = Bluebird.method(async (gameMode: string, loot: typeof LootProm) => {
    const t = this.mExtensionApi.translate;
    const masterlistPath = path.join(util.getVortexPath('userData'), gameMode,
                                     'masterlist', 'masterlist.yaml');
    const userlistPath = path.join(util.getVortexPath('userData'), gameMode, 'userlist.yaml');
    const preludePath = path.join(util.getVortexPath('userData'), 'loot_prelude', 'prelude.yaml');

    let mtime: Date;
    try {
      mtime = (await fs.statAsync(userlistPath)).mtime;
    } catch (err) {
      mtime = null;
    }

    let usePrelude: boolean = false;
    try {
      await fs.statAsync(preludePath);
      usePrelude = true;
    } catch (err) {
      // nop
    }

    // load & evaluate lists first time we need them and whenever
    // the userlist has changed
    if ((mtime !== null) &&
        // this.mUserlistTime could be undefined or null
        (!this.mUserlistTime ||
         (this.mUserlistTime.getTime() !== mtime.getTime()))) {
      log('info', '(re-)loading loot lists', {
        mtime,
        masterlistPath,
        userlistPath,
        last: this.mUserlistTime,
      });
      try {
        await fs.statAsync(masterlistPath);
        await loot.loadListsAsync(
          masterlistPath,
          mtime !== null ? userlistPath : '',
          usePrelude ? preludePath : '');
        log('info', 'loaded loot lists');
        this.mUserlistTime = mtime;
      } catch (err) {
        this.mExtensionApi.showErrorNotification('Failed to load master-/userlist', err, {
            allowReport: false,
          } as any);
      }
    }
  });

  private convertGameId(gameMode: string, masterlist: boolean) {
    // the vr games use the same masterlist as the base game but have their own game id within loot.
    // with enderal it's the other way around, they use the game id of the base game but there is
    // a separate masterlist (one for both variants)
    if (masterlist && (gameMode === 'fallout4vr')) {
      return 'fallout4';
    } else if (masterlist && (gameMode === 'skyrimvr')) {
      return 'skyrimse';
    } else if (masterlist && (gameMode === 'oblivionremastered')) {
      return 'oblivion';
    } else if (gameMode === 'enderal') {
      return masterlist ? 'enderal' : 'skyrim';
    } else if (gameMode === 'enderalspecialedition') {
      return masterlist ? 'enderal' : 'skyrimse';
    }
    return gameMode;
  }

  // tslint:disable-next-line:member-ordering
  private init = Bluebird.method(async (gameMode: string) => {
    const localPath = pluginPath(gameMode);
    try {
      await fs.ensureDirAsync(localPath);
    } catch (err) {
      this.mExtensionApi.showErrorNotification('Failed to create necessary directory', err, {
          allowReport: false,
        });
    }

    let loot: any;

    try {
      loot = Bluebird.promisifyAll(
        await LootProm.createAsync(this.convertGameId(gameMode, false), this.gamePath,
                                   localPath, 'en', this.log, this.fork));
    } catch (err) {
      this.mExtensionApi.showErrorNotification('Failed to initialize LOOT', err, {
        allowReport: false,
      } as any);
      return { game: gameMode, loot: undefined };
    }
    const masterlistRepoPath = path.join(util.getVortexPath('userData'), gameMode, 'masterlist');
    const masterlistPath = path.join(masterlistRepoPath, 'masterlist.yaml');
    const preludePath = path.join(util.getVortexPath('userData'), 'loot_prelude', 'prelude.yaml');
    await this.downloadMasterlist(gameMode);

    try {
      // we need to ensure lists get loaded at least once. before sorting there
      // will always be a check if the userlist was changed
      const userlistPath = path.join(util.getVortexPath('userData'), gameMode, 'userlist.yaml');

      let mtime: Date;
      try {
        mtime = (await fs.statAsync(userlistPath)).mtime;
      } catch (err) {
        mtime = null;
      }

      let usePrelude: boolean = false;
      try {
        await fs.statAsync(preludePath);
        usePrelude = true;
      } catch (err) {
        // nop
      }

      // ensure masterlist is available
      await fs.statAsync(masterlistPath);
      await loot.loadListsAsync(
        masterlistPath,
        mtime !== null ? userlistPath : '',
        usePrelude ? preludePath : '');
      await loot.loadCurrentLoadOrderStateAsync();
      this.mUserlistTime = mtime;
    } catch (err) {
      this.mExtensionApi.showErrorNotification('Failed to load master-/userlist', err, {
          allowReport: false,
        } as any);
    }

    return { game: gameMode, loot };
  });

  private fork = (modulePath: string, args: string[]) => {
    (this.mExtensionApi as any).runExecutable(process.execPath, [modulePath].concat(args || []), {
      detach: false,
      suggestDeploy: false,
      expectSuccess: true,
      env: {
        ELECTRON_RUN_AS_NODE: '1',
      },
    })
      .catch(util.UserCanceled, () => null)
      .catch(util.ProcessCanceled, () => null)
      .catch(err => {
        log('warn', 'LOOT process died', { error: err.message });
        if (this.mRestarts > 0) {
          const gameMode = selectors.activeGameId(this.mExtensionApi.store.getState());
          --this.mRestarts;
          if (gameSupported(gameMode, true)) {
            this.mInitPromise = this.init(gameMode);
          }
        } else {
          this.mExtensionApi.showErrorNotification('LOOT process died', err);
        }
      });
  }

  private mHashWarningLogged = false;
  private log = (level: number, message: string) => {
    if (this.mHashWarningLogged) {
      return;
    }
    if (message.includes('and file with hashes') && !this.mHashWarningLogged) {
      // Ugly hack - but hash related errors will be logged for EACH file within a
      //  Bethesda archive which will end up spamming Vortex to Oblivion with information
      //  the user can't even see. One instance of this is enough for us to pinpoint
      //  a BSA/BA2 conflict in the future (if it's ever implemented)
      this.mHashWarningLogged = true;
      return;
    }
    log(this.logLevel(level) as any, message);
  };

  private logLevel(level: number): string {
    switch (level) {
      case 0: return 'debug'; // actually trace
      case 1: return 'debug';
      case 2: return 'info';
      case 3: return 'warn';
      case 4: return 'error';
      case 5: return 'error'; // actually fatal
    }
  }

  private renderEdge(t: typeof i18next.t, edge: ICycleEdge): string {
    switch (edge.typeOfEdgeToNextVertex) {
      case EdgeType.masterlistLoadAfter:
      case EdgeType.masterlistRequirement:
        return t('masterlist');
      case EdgeType.userLoadAfter:
      case EdgeType.userRequirement:
        return t('custom');
      case EdgeType.hardcoded:
        return t('hardcoded');
      case EdgeType.assetOverlap:
        return t('overlap (asset)');
      case EdgeType.recordOverlap:
        return t('overlap (record)');
      case EdgeType.tieBreak:
        return t('tie breaker');
      default:
        return '???';
    }
  }

  private async describeEdge(t: typeof i18next.t,
                             edge: ICycleEdge, edgeGroup: string,
                             next: ICycleEdge, nextGroup: string,
                             loot: typeof LootProm): Promise<string> {
    switch (edge.typeOfEdgeToNextVertex) {
      case EdgeType.master:
      case EdgeType.masterFlag:
        return t('{{master}} is a master and {{regular}} isn\'t', {
          replace: {
            master: edge.name, regular: next.name,
          }
        });
      case EdgeType.masterlistLoadAfter:
      case EdgeType.masterlistRequirement:
        return t('this is a masterlist rule');
      case EdgeType.userLoadAfter:
      case EdgeType.userRequirement:
        return t('this is a custom rule');
      case EdgeType.hardcoded:
        return t('hardcoded');
      case EdgeType.assetOverlap:
        return t('assets (content of BSA/BA2) overlap');
      case EdgeType.recordOverlap:
        return t('records (content of ESx) overlap');
      case EdgeType.tieBreak:
        return t('tie breaker');
      case EdgeType.userGroup:
      case EdgeType.masterlistGroup: {
        try {
          const groupPath: ICycleEdge[] =
            await loot.getGroupsPathAsync(edgeGroup || 'default', nextGroup || 'default');
          return t('groups are connected like this: {{path}}', {
            replace: {
              path: groupPath.map(grp => {
                const connection = grp.typeOfEdgeToNextVertex === 'hardcoded'
                  ? ''
                  : ` --(${this.renderEdge(t, grp)})->`;
                return `${grp.name}${connection}`;
              }).join(' '),
            }
          });
        } catch (err) {
          log('warn', 'failed to determine path between groups', err.message);
          return t('groups are connected');
        }
      }
    }
  }

  private getGroup(state: any, pluginName: string): { group: string, custom: boolean } {
    const ulEdge = (state.userlist.plugins ?? []).find(
      iter => iter.name.toLowerCase() === pluginName.toLowerCase());
    if ((ulEdge !== undefined) && (ulEdge.group !== undefined)) {
      return { group: ulEdge.group, custom: true };
    }
    const mlEdge = (state.masterlist.plugins ?? []).find(
      iter => iter.name.toLowerCase() === pluginName.toLowerCase());
    if ((mlEdge !== undefined) && (mlEdge.group !== undefined)) {
      return { group: mlEdge.group, custom: false };
    }
    return { group: undefined, custom: false };
  }

  private async renderCycle(t: typeof i18next.t,
                            cycle: ICycleEdge[],
                            loot: typeof LootProm): Promise<string> {
    const state = this.mExtensionApi.store.getState();
    const lines = await Promise.all(cycle.map(async (edge: ICycleEdge, idx: number) => {
      const next = cycle[(idx + 1) % cycle.length];
      const edgeGroup = this.getGroup(state, edge.name);
      const nextGroup = this.getGroup(state, next.name);

      const groupDescription = edgeGroup.custom
        ? `[tooltip="${t('This group was manually assigned')}"]`
          + `${edgeGroup.group || 'default'}[/tooltip]`
        : (edgeGroup.group || 'default');
      const edgeDescription =
        await this.describeEdge(t, edge, edgeGroup.group, next, nextGroup.group, loot);

      const connection = `[tooltip="${edgeDescription}"]-->[/tooltip]`;

      return `${edge.name}@[i]${groupDescription}[/i] ${connection}`;
    }));
    const firstGroup = this.getGroup(state, cycle[0].name);
    return lines.join(' ') + ` ${cycle[0].name}@[i]${firstGroup.group || 'default'}[/i]`;
  }

  private async getSolutions(t: typeof i18next.t,
                             cycle: ICycleEdge[],
                             loot: typeof LootProm): Promise<types.ICheckbox[]> {
    const userTypes = [
      EdgeType.userLoadAfter,
      EdgeType.userRequirement,
    ];
                               
    const groupTypes = [
      EdgeType.masterlistGroup,
      EdgeType.userGroup
    ];

    const result: types.ICheckbox[] = [];

    await Promise.all(cycle.map(async (edge: ICycleEdge, idx: number) => {
      const next = cycle[(idx + 1) % cycle.length];
      if (userTypes.includes(edge.typeOfEdgeToNextVertex)) {
        result.push({
          id: `removerule:${edge.name}:${next.name}:${edge.typeOfEdgeToNextVertex}`,
          text: t('Remove custom rule between "{{name}}" and "{{next}}"', { replace: {
            name: edge.name, next: next.name,
          } }),
          value: false,
        });
      } else if (groupTypes.includes(edge.typeOfEdgeToNextVertex)) {
        const state = this.mExtensionApi.store.getState();
        const edgeGroup = this.getGroup(state, edge.name);
        const nextGroup = this.getGroup(state, next.name);
        if (edgeGroup.custom) {
          result.push({
            id: `unassign:${edge.name}`,
            text: t('Remove custom group assignment to "{{name}}"', { replace: {
              name: edge.name,
            } }),
            value: false,
          });
        }
        if (nextGroup.custom) {
          result.push({
            id: `unassign:${next.name}`,
            text: t('Remove custom group assignment to "{{name}}"', { replace: {
              name: next.name,
            } }),
            value: false,
          });
        }
        try {
          const groupPath: ICycleEdge[] = await
            loot.getGroupsPathAsync(edgeGroup.group || 'default', nextGroup.group || 'default');
          if (groupPath.find(iter => userTypes.indexOf(iter.typeOfEdgeToNextVertex) !== -1)) {
            result.push({
              // Storing the plugin names here instead of the group directly because the plugin
              //   names are file names on disk and thus won't contain colons, meaning we can
              //   cleanly parse this id later, the same would be more complicated with group names
              id: `resetgroups:${edge.name}:${next.name}`,
              text: t('Reset customized groups between "{{first}}@{{firstGroup}}" '
                + 'and "{{second}}@{{secondGroup}}"', {
                  replace: {
                    first: edge.name,
                    firstGroup: edgeGroup.group || 'default',
                    second: next.name,
                    secondGroup: nextGroup.group || 'default',
                  },
              }),
              value: false,
            });
          }
        } catch (err) {
          log('warn', 'failed to determine path between groups', err.message);
        }
      }
    }));

    return result;
  }

  private async applyFix(key: string, loot: typeof LootProm) {
    const api = this.mExtensionApi;

    const args = key.split(':');
    if (args[0] === 'removerule') {
      api.store.dispatch(removeRule(args[2], args[1],
        args[3] === EdgeType.userRequirement ? 'requires' : 'after'));
    } else if (args[0] === 'unassign') {
      api.store.dispatch(setGroup(args[1], undefined));
    } else if (args[0] === 'resetgroups') {
      const state = api.store.getState();
      const edgeGroup = this.getGroup(state, args[1]);
      const nextGroup = this.getGroup(state, args[2]);

      try {
        const cyclePath: ICycleEdge[] =
          await loot.getGroupsPathAsync(edgeGroup.group || 'default', nextGroup.group || 'default');

        cyclePath.forEach((pathEdge, idx) => {
          if ((pathEdge.typeOfEdgeToNextVertex === EdgeType.userLoadAfter)
            || (pathEdge.typeOfEdgeToNextVertex === EdgeType.userRequirement)) {
            const pathNext = cyclePath[(idx + 1) % cyclePath.length];
            api.store.dispatch(
              removeGroupRule(pathNext.name || 'default', pathEdge.name || 'default'));
          }
        });
      } catch (err) {
        log('warn', 'failed to determine path between groups', err.message);
      }
    } else {
      api.showErrorNotification('Invalid fix instruction for cycle, please report this', key);
    }
  }

  private async reportCycle(err: Error, loot: typeof LootProm) {
    const api = this.mExtensionApi;
    const t = api.translate;

    let solutions: types.ICheckbox[];
    let renderedCycle: string;

    try {
      solutions = await this.getSolutions(t, (err as any).cycle, loot);
      renderedCycle = await this.renderCycle(t, (err as any).cycle, loot);
    } catch (err) {
      if (err.message.toLowerCase() === 'already closed') {
        return;
      } else {
        this.mExtensionApi.showErrorNotification('Failed to report plugin cycle', err);
        return;
      }
    }

    const errActions: types.IDialogAction[] = [
      {
        label: 'Close',
      },
    ];
    if (solutions.length > 0) {
      errActions.push({
        label: 'Apply Selected',
      });
    }

    this.mExtensionApi.sendNotification({
      id: 'loot-cycle-warning',
      type: 'warning',
      message: 'Plugins not sorted because of cyclic rules',
      actions: [
        {
          title: 'More',
          action: (dismiss: () => void) => {
            const bbcode = t(
              'LOOT reported a cyclic interaction between rules.<br />'
              + 'In the simplest case this is something like '
              + '[i]"A needs to load after B"[/i] and [i]"B needs to load after A"[/i] '
              + 'but it can be more complicated, involving multiple plugins and groups and '
              + '[i]their[/i] order.<br />',
              { ns: NAMESPACE })
              + '<br />' + renderedCycle;
            this.mExtensionApi.showDialog('info', 'Cyclic interaction', {
                  bbcode,
                  checkboxes: solutions,
                }, errActions)
              .then(result => {
                if (result.action === 'Apply Selected') {
                  const selected = Object.keys(result.input)
                    .filter(key => result.input[key]);

                  selected.sort((lhs, rhs) => {
                      // reset groups first because if one of the other commands changes the
                      // groups those might not work any more or reset a different list of groups
                      if (lhs.startsWith('resetgroups')) {
                        return -1;
                      } else if (rhs.startsWith('resetgroups')) {
                        return 1;
                      } else {
                        return lhs.localeCompare(rhs);
                      }
                    })
                    .forEach(key => this.applyFix(key, loot));

                  if (selected.length > 0) {
                    // sort again
                    this.onSort(true);
                  }
                }
              });
          },
        },
      ],
    });
  }
}

export default LootInterface;
