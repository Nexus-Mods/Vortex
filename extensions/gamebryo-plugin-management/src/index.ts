/* eslint-disable */
import {
  setPluginEnabled,
  setPluginOrder,
  updatePluginOrder,
} from "./actions/loadOrder";
import {
  clearNewPluginCounter,
  incrementNewPluginCounter,
  setPluginFilePath,
  setPluginList,
  updatePluginWarnings,
} from "./actions/plugins";
import { removeGroupRule, setGroup } from "./actions/userlist";
import { openGroupEditor, setCreateRule } from "./actions/userlistEdit";
import { loadOrderReducer } from "./reducers/loadOrder";
import { pluginsReducer } from "./reducers/plugins";
import { settingsReducer } from "./reducers/settings";
import userlistReducer from "./reducers/userlist";
import userlistEditReducer from "./reducers/userlistEdit";
import { ILoadOrder } from "./types/ILoadOrder";
import { ILOOTList, ILootReference, ILOOTSortApiCall } from "./types/ILOOTList";
import { IPlugin, IPluginCombined, IPlugins } from "./types/IPlugins";
import { IStateEx } from "./types/IStateEx";
import {
  gameDataPath,
  gameSupported,
  getGameSupport,
  IGameSupport,
  initGameSupport,
  isNativePlugin,
  minRevision,
  nativePlugins,
  pluginExtensions,
  pluginPath,
  revisionText,
  syncGameSupport,
  supportedGames,
  supportsESL,
  supportsMediumMasters,
} from "./util/gameSupport";
import { markdownToBBCode } from "./util/mdtobb";
import PluginHistory from "./util/PluginHistory";
import PluginPersistor from "./util/PluginPersistor";
import toPluginId from "./util/toPluginId";
import UserlistPersistor from "./util/UserlistPersistor";
import Connector from "./views/Connector";
import GroupEditor from "./views/GroupEditor";
import PluginList from "./views/PluginList";
import Settings from "./views/Settings";
import UserlistEditor from "./views/UserlistEditor";

import LootInterface from "./autosort";
import { GHOST_EXT, NAMESPACE } from "./statics";

import Promise from "bluebird";
import { ipcMain, ipcRenderer } from "electron";
import ESPFile from "esptk";
import { access, constants } from "fs";
import I18next from "i18next";
import * as path from "path";
import * as Redux from "redux";
import * as nodeUtil from "util";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { getPluginFlags } from "./views/PluginFlags";
import { createSelector } from "reselect";
import { IESPFile } from "./types/IESPFile";
import {
  isMasterlistOutdated,
  masterlistExists,
  masterlistFilePath,
} from "./util/masterlist";

type TranslationFunction = typeof I18next.t;

interface IModState {
  enabled: boolean;
}

interface IModStates {
  [modId: string]: IModState;
}

function isFile(fileName: string): Promise<boolean> {
  return (
    fs
      .isDirectoryAsync(fileName)
      .then((res) => !res)
      // Given that this function runs asynchronously, Vortex may be creating/modifying
      //  its temporary deployment files 'vortex.deployment.json.XXXXXX.tmp' in the background,
      //  which may be removed by the time isDirectoryAsync finishes its operations,
      //  throwing an ENOENT error.
      //  This is an arguably acceptable scenario given that the .tmp file extension would've failed
      //  the following isPlugin predicate anyway so we can just return false here.
      .catch((err) =>
        ["ENOENT", "UNKNOWN"].indexOf(err.code) !== -1
          ? Promise.resolve(true)
          : Promise.reject(err),
      )
  );
}

function isPlugin(
  filePath: string,
  fileName: string,
  gameMode: string,
): Promise<boolean> {
  if (path.extname(fileName) === GHOST_EXT) {
    fileName = path.basename(fileName, GHOST_EXT);
  }

  if (
    !fileName ||
    pluginExtensions(gameMode).indexOf(
      path.extname(path.basename(fileName)).toLowerCase(),
    ) === -1
  ) {
    return Promise.resolve(false);
  }
  return isFile(path.join(filePath, fileName)).catch(
    util.UserCanceled,
    () => false,
  );
}

/**
 * updates the list of known plugins for the managed game
 */
function updatePluginListImpl(
  store: types.ThunkStore<any>,
  newModList: IModStates,
  gameId: string,
): Promise<void> {
  const state: types.IState = store.getState();

  const pluginSources: { [pluginName: string]: string } = {};
  const pluginStates: IPlugins = {};

  const setPluginState = (
    basePath: string,
    fileName: string,
    deployed: boolean,
  ) => {
    const modId =
      pluginSources[fileName] !== undefined ? pluginSources[fileName] : "";
    const pluginId = toPluginId(fileName);
    pluginStates[pluginId] = {
      modId,
      filePath: path.join(basePath, fileName),
      isNative: isNativePlugin(gameId, fileName),
      warnings: util.getSafe(
        state,
        ["session", "plugins", "pluginList", pluginId, "warnings"],
        {},
      ),
      deployed,
    };
    return Promise.resolve();
  };

  const discovery = (selectors as any).discoveryByGame(state, gameId);
  if (discovery === undefined || discovery.path === undefined) {
    // paranoia, this shouldn't happen
    return Promise.resolve();
  }
  const readErrors = [];

  const gameMods = state.persistent.mods[gameId] || {};
  const game = util.getGame(gameId);
  if (game === undefined) {
    // we may get here if the active game is no longer supported due to
    // the extension being disabled.
    return Promise.resolve();
  }

  const modType = game.details?.dataModType || "";
  const modPath = game.getModPaths(discovery.path)[modType];

  const enabledModIds = Object.keys(gameMods).filter((modId) =>
    util.getSafe(newModList, [modId, "enabled"], false),
  );

  const activator = util.getCurrentActivator(state, gameId, true);

  const installBasePath = selectors.installPathForGame(state, gameId);
  // create a cache of all plugins that originate from a mod so we can assign
  // the correct origin further down
  return Promise.map(enabledModIds, (modId: string) => {
    const mod = gameMods[modId];
    if (mod === undefined || mod.installationPath === undefined) {
      log("error", "mod not found", { gameId, modId });
      return;
    }
    const isOverriden = (fileName: string) =>
      (mod.fileOverrides ?? []).some(
        (override) => path.basename(override) === fileName,
      );
    const modInstPath = path.join(installBasePath, mod.installationPath);
    return fs
      .readdirAsync(modInstPath)
      .map((fileName) =>
        activator !== undefined
          ? (activator as any).getDeployedPath(fileName)
          : fileName,
      )
      .filter((fileName: string) =>
        isPlugin(modInstPath, fileName, gameId).then((res) =>
          Promise.resolve(res && !isOverriden(fileName)),
        ),
      )
      .each((fileName: string) => {
        pluginSources[fileName] = mod.id;
        return setPluginState(modInstPath, fileName, false);
      })
      .catch((err: Error) => {
        readErrors.push(mod.id);
        log("warn", "failed to read mod directory", {
          path: mod.installationPath,
          error: err.message,
        });
      });
  })
    .then(() => {
      if (readErrors.length > 0) {
        util.showError(
          store.dispatch,
          "Failed to read some mods",
          "The following mods could not be searched (see log for details):\n" +
            readErrors.map((error) => `"${error}"`).join("\n"),
          { allowReport: false, id: "failed-to-read-mods" },
        );
      } else {
        store.dispatch(actions.dismissNotification("failed-to-read-mods"));
      }

      if (discovery === undefined) {
        return Promise.resolve([]);
      }
      // if reading the mod directory fails that's probably a broken installation,
      // but it's not the responsible of this extension to report that, the
      // game mode management will notice this as well.
      return fs.readdirAsync(modPath).catch((err) => []);
    })
    .then((fileNames: string[]) => {
      return Promise.filter(fileNames, (val) => isPlugin(modPath, val, gameId))
        .each((fileName: string) => setPluginState(modPath, fileName, true))
        .then(() => {
          store.dispatch(setPluginList(pluginStates));
          if (Object.keys(pluginStates).length > 0) {
            const notDeployed = Object.keys(pluginStates).find(
              (key) => !pluginStates[key].deployed,
            );
            if (notDeployed !== undefined) {
              store.dispatch(
                (actions as any).setDeploymentNecessary(gameId, true),
              );
            }
            const knownPlugins = Object.keys(pluginStates).reduce(
              (prev, pluginId) => {
                prev[pluginId] = path.basename(pluginStates[pluginId].filePath);
                return prev;
              },
              {},
            );
            ipcRenderer.send("gamebryo-set-known-plugins", knownPlugins);
          }
          return Promise.resolve();
        });
    })
    .catch((err: Error) => {
      util.showError(store.dispatch, "Failed to update plugin list", err);
    });
}

function withActivity<T>(
  store: Redux.Store<any>,
  groupId: string,
  activity: string,
  cb: () => Promise<T>,
): Promise<T> {
  store.dispatch(actions.startActivity(groupId, activity));
  return cb().finally(() => {
    store.dispatch(actions.stopActivity(groupId, activity));
  });
}

function updatePluginList(
  store: Redux.Store<any>,
  newModList: IModStates,
  gameId: string,
) {
  return withActivity(store, "plugins", "update-plugin-list", () =>
    updatePluginListImpl(store, newModList, gameId),
  );
}

function renamePlugin(
  api: types.IExtensionApi,
  gameId: string,
  plugin: IPluginCombined,
  targetPath: string,
): Promise<void> {
  const renameProm = fs.renameAsync(plugin.filePath, targetPath);
  if (!plugin.modId) {
    return renameProm;
  } else {
    // if we have a corresponding mod we need to rename the file in the staging directory instead,
    // deployment will later figure out the file in the game directory
    const state = api.getState();
    const stagingPath = selectors.installPathForGame(state, gameId);
    const mod = state.persistent.mods[gameId][plugin.modId];
    const srcName = path.basename(plugin.filePath);
    const dstName = path.basename(targetPath);

    return renameProm
      .then(() =>
        fs.renameAsync(
          path.join(stagingPath, mod.installationPath, srcName),
          path.join(stagingPath, mod.installationPath, dstName),
        ),
      )
      .then(() => fs.removeAsync(plugin.filePath));
  }
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFile: (
    gameId: string,
    filePath: string | (() => PromiseLike<string[]>),
  ) => void;
}

let pluginPersistor: PluginPersistor;
let userlistPersistor: UserlistPersistor;
let masterlistPersistor: UserlistPersistor;
let loot: LootInterface;
let refreshTimer: NodeJS.Timeout;
let deploying = false;

function makeSetPluginGhost(api: types.IExtensionApi) {
  return (
    pluginId: string,
    gameMode: string,
    ghosted: boolean,
    enabled: boolean,
  ) => {
    const state = api.store.getState();
    const { pluginList } = state.session.plugins;
    const plugin: IPluginCombined = pluginList?.[pluginId];
    if (plugin === undefined) {
      log("warn", "invalid plugin id", pluginId);
      return;
    }
    let targetPath = path.join(
      path.dirname(plugin.filePath),
      path.basename(plugin.filePath, GHOST_EXT),
    );
    if (ghosted) {
      targetPath += GHOST_EXT;
    }

    if (path.basename(targetPath) === path.basename(plugin.filePath)) {
      // The targetPath matches the current filePath - do nothing
      return;
    }

    return renamePlugin(api, gameMode, plugin, targetPath)
      .then(() => {
        api.store.dispatch(setPluginFilePath(pluginId, targetPath));
        api.store.dispatch(setPluginEnabled(pluginId, enabled));
      })
      .catch((err) => {
        api.showErrorNotification("Failed to rename plugin", err, {
          allowReport: false,
        });
      });
  };
}

// TODO bad hack. converting a plugin to light or back invalidates the cache the PluginList
// holds so we use this to force an update. The better solution would be to decouple the cache
// from the component and update the cache directly
const forceListUpdate = util.makeReactive({});

function register(
  context: IExtensionContextExt,
  setPluginLight: (id: string, enable: boolean) => void,
) {
  context.registerReducer(["session", "plugins"], pluginsReducer);
  context.registerReducer(["loadOrder"], loadOrderReducer);
  context.registerReducer(["userlist"], userlistReducer);
  context.registerReducer(["masterlist"], { defaults: {}, reducers: {} });
  context.registerReducer(["settings", "plugins"], settingsReducer);
  context.registerReducer(
    ["session", "pluginDependencies"],
    userlistEditReducer,
  );

  const pluginActivity = new util.ReduxProp(
    context.api,
    [["session", "base", "activity", "plugins"]],
    (activity: string[]) => activity !== undefined && activity.length > 0,
  );

  const isMaster = (
    filePath: string,
    flag: boolean,
    gameMode: string,
  ): boolean => {
    if (path.extname(filePath) === GHOST_EXT) {
      filePath = path.basename(filePath, GHOST_EXT);
    }
    const masterExts = supportsESL(gameMode) ? [".esm", ".esl"] : [".esm"];
    return (
      flag || masterExts.indexOf(path.extname(filePath).toLowerCase()) !== -1
    );
  };

  const isMediumMaster = (
    filePath: string,
    flag: boolean,
    gameMode: string,
  ): boolean => {
    if (path.extname(filePath) === GHOST_EXT) {
      filePath = path.basename(filePath, GHOST_EXT);
    }
    const masterExts = [".esm"];
    const file = new ESPFile(filePath, gameMode);
    return (
      flag ||
      (masterExts.indexOf(path.extname(filePath).toLowerCase()) !== -1 &&
        file.isMedium)
    );
  };

  const isLight = (filePath: string, flag: boolean, gameMode: string) => {
    if (path.extname(filePath) === GHOST_EXT) {
      filePath = path.basename(filePath, GHOST_EXT);
    }
    if (!supportsESL(gameMode)) {
      return false;
    }
    return flag || path.extname(filePath).toLowerCase() === ".esl";
  };

  const openLOOTSite = () =>
    util.opn("https://loot.github.io/").catch(() => null);

  const parseESPFile = (filePath: string, gameMode: string): IESPFile => {
    const fileInfo = new ESPFile(filePath, gameMode);
    return {
      isMaster: fileInfo.isMaster,
      isLight: fileInfo.isLight,
      isMedium: fileInfo.isMedium,
      isDummy: fileInfo.isDummy,
      author: fileInfo.author,
      description: fileInfo.description,
      masterList: fileInfo.masterList,
      revision: fileInfo.revision,
    };
  };

  const safeBasename = (filePath: string) => {
    return filePath !== undefined ? path.basename(filePath, GHOST_EXT) : "";
  };

  const loadOrder = (state) => state.loadOrder;
  const enabledPlugins = createSelector(
    loadOrder,
    selectors.activeGameId,
    (order, gameId) => {
      if (!gameSupported(gameId)) {
        return new Set<string>([]);
      }
      return new Set<string>(
        [].concat(
          nativePlugins(gameId),
          Object.keys(order)
            .filter((pluginName: string) => order[pluginName].enabled)
            .map((pluginName: string) => pluginName.toLowerCase()),
        ),
      );
    },
  );

  const pluginCounter = new util.ReduxProp(
    context.api,
    [["session", "plugins", "newlyAddedPlugins"]],
    (value: number) => (value > 0 ? value : undefined),
  );

  const installedPlugins = () => enabledPlugins(context.api.store.getState());
  context.registerMainPage("plugins", "Plugins", PluginList, {
    id: "gamebryo-plugins",
    hotkey: "E",
    group: "per-game",
    visible: () => {
      const state = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return gameSupported(gameMode);
    },
    props: () => ({
      gameSupported,
      minRevision,
      supportsESL,
      supportsMediumMasters,
      getPluginFlags,
      revisionText,
      isMaster,
      isLight,
      isMediumMaster,
      openLOOTSite,
      parseESPFile,
      forceListUpdate,
      safeBasename,
      installedPlugins,
      nativePlugins: gameSupported(
        selectors.activeGameId(context.api.store.getState()),
      )
        ? nativePlugins(selectors.activeGameId(context.api.store.getState()))
        : [],
      onRefreshPlugins: () => updateCurrentProfile(context.api),
      onSetPluginGhost: makeSetPluginGhost(context.api),
      onSetPluginLight: setPluginLight,
    }),
    activity: pluginActivity,
    badge: pluginCounter,
  });

  for (const gameId of supportedGames()) {
    context.registerProfileFile(gameId, () =>
      Promise.resolve([path.join(pluginPath(gameId), "plugins.txt")]),
    );
    context.registerProfileFile(gameId, () =>
      Promise.resolve([path.join(pluginPath(gameId), "loadorder.txt")]),
    );
  }

  context.registerSettings("Workarounds", Settings, undefined, () => {
    const state = context.api.store.getState();
    const gameMode = selectors.activeGameId(state);
    return supportedGames().indexOf(gameMode) !== -1;
  });

  context.registerAPI(
    "lootSortAsync",
    async (sortCall: ILOOTSortApiCall) => {
      const { pluginFilePaths, onSortCallback } = sortCall;
      if (!Array.isArray(pluginFilePaths) || onSortCallback === undefined) {
        log("error", "incorrect lootSortAsync call parameters");
        onSortCallback(
          new Error("incorrect lootSortAsync call parameters"),
          [],
        );
        return;
      }
      const profile = selectors.activeProfile(context.api.store.getState());
      try {
        const masterListExists = await masterlistExists(profile.gameId);
        if (!masterListExists) {
          await loot.downloadMasterlist(profile.gameId);
        }
        await updatePluginList(
          context.api.store,
          profile.modState,
          profile.gameId,
        );
        await new Promise((resolve, reject) => {
          const pluginList = util.getSafe(
            context.api.getState(),
            ["session", "plugins", "pluginList"],
            {},
          );
          context.api.events.emit(
            "plugin-details",
            profile.gameId,
            Object.keys(pluginList ?? {}),
            resolve,
          );
        });
        context.api.events.emit("autosort-plugins", true, (err: Error) => {
          if (err) {
            onSortCallback(err, []);
          }
          const sortedLO = context.api.getState()?.["loadOrder"] || {};
          const sortedList = Object.keys(sortedLO)
            .sort(
              (lhs, rhs) => sortedLO[lhs].loadOrder - sortedLO[rhs].loadOrder,
            )
            .map((pluginName: string) => pluginName.toLowerCase());

          onSortCallback(null, sortedList);
        });
      } catch (err) {
        log("error", "failed to update plugin list", err);
        onSortCallback(err, []);
        return;
      }
    },
    { minArguments: 1 },
  );

  context.registerAction(
    "gamebryo-plugin-icons",
    100,
    "connection",
    {},
    "Manage Rules",
    () => {
      context.api.store.dispatch(
        setCreateRule(undefined, undefined, undefined),
      );
    },
  );

  context.registerAction(
    "gamebryo-plugin-icons",
    105,
    "groups",
    {},
    "Manage Groups",
    () => {
      context.api.store.dispatch(openGroupEditor(true));
    },
  );

  context.registerAction(
    "gamebryo-plugin-icons",
    200,
    "history",
    {},
    "History",
    () => {
      context.api.ext.showHistory?.("plugins");
    },
  );

  context.registerActionCheck(
    "GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED",
    (state: any, action: any) => {
      // Bit of a hack - we need to let the plugin persistor
      //  know that the plugin management is enabled for this profile.
      if (process.type === "renderer") {
        const { profileId, enabled } = action.payload;
        const profile = selectors.profileById(state, profileId);
        const currentState = util.getSafe(
          state,
          ["pluginManagementEnabled", profileId],
          false,
        );
        if (currentState !== enabled) {
          if (enabled) {
            ipcRenderer.send(
              "gamebryo-gamesupport-sync-state",
              profile.gameId,
              sanitizeForIPC(getGameSupport()[profile.gameId]),
            );
          }
          sendStartStopSync(enabled);
        }
        return undefined;
      }
    },
  );

  context.registerActionCheck(
    "ADD_USERLIST_RULE",
    (state: any, action: any) => {
      const { pluginId, reference, type } = action.payload;

      const plugin = (state.userlist.plugins ?? []).find(
        (iter) => iter.name === pluginId,
      );
      if (plugin !== undefined) {
        if ((plugin[type] || []).indexOf(reference) !== -1) {
          return `Duplicate rule "${pluginId} ${type} ${reference}"`;
        }
      }

      return undefined;
    },
  );

  const pluginInfoCache = new PluginInfoCache(context.api);

  context.registerTest("plugins-locked", "gamemode-activated", () =>
    testPluginsLocked(selectors.activeGameId(context.api.store.getState())),
  );
  context.registerTest("master-missing", "gamemode-activated", () =>
    testMissingMasters(context.api, pluginInfoCache),
  );
  context.registerTest("master-missing", "plugins-changed" as any, () =>
    testMissingMasters(context.api, pluginInfoCache),
  );
  context.registerTest("rules-unfulfilled", "loot-info-updated" as any, () =>
    testRulesUnfulfilled(context.api),
  );
  context.registerTest("invalid-userlist", "gamemode-activated", () =>
    testUserlistInvalid(context.api.translate, context.api.store.getState()),
  );
  context.registerTest("missing-groups", "gamemode-activated", () =>
    testMissingGroups(context.api.translate, context.api.store),
  );
  context.registerTest("exceeded-plugin-limit", "plugins-changed", () =>
    testExceededPluginLimit(context.api, pluginInfoCache),
  );
  context.registerDialog("plugin-dependencies-connector", Connector);
  context.registerDialog("userlist-editor", UserlistEditor);
  context.registerDialog("group-editor", GroupEditor);
}

/**
 * initialize persistor, exposing the content of plugins.txt / loadorder.txt to
 * the store
 */
function initPersistor(context: IExtensionContextExt) {
  const onError = (
    message: string,
    detail: Error,
    options?: types.IErrorOptions,
  ) => {
    context.api.showErrorNotification(message, detail, options);
  };
  // TODO: Currently need to stop this from being called in the render process.
  //   This is mega-ugly and needs to go
  if (process.type === "browser") {
    if (pluginPersistor === undefined) {
      pluginPersistor = new PluginPersistor(
        onError,
        () => context.api.store.getState().settings.plugins.autoSort,
      );
    }
    if (userlistPersistor === undefined) {
      userlistPersistor = new UserlistPersistor("userlist", onError);
    }
    if (masterlistPersistor === undefined) {
      masterlistPersistor = new UserlistPersistor("masterlist", onError);
    }
  }
  if (pluginPersistor !== undefined) {
    context.registerPersistor("loadOrder", pluginPersistor);
  }
  if (userlistPersistor !== undefined) {
    context.registerPersistor("userlist", userlistPersistor);
  }
  if (masterlistPersistor !== undefined) {
    context.registerPersistor("masterlist", masterlistPersistor);
  }
}

/**
 * update the plugin list for the currently active profile
 */
function updateCurrentProfile(api: types.IExtensionApi): Promise<void> {
  const gameId = selectors.activeGameId(api.getState());

  if (!gameSupported(gameId)) {
    return Promise.resolve();
  }

  const profile = selectors.activeProfile(api.getState());
  if (profile === undefined) {
    log("warn", "no profile active");
    return Promise.resolve();
  }

  return new Promise<void>(async (resolve, reject) => {
    await updatePluginList(api.store, profile.modState, profile.gameId);
    const pluginList = util.getSafe(
      api.getState(),
      ["session", "plugins", "pluginList"],
      {},
    );
    api.events.emit(
      "plugin-details",
      profile.gameId,
      Object.keys(pluginList ?? {}),
      resolve,
    );
  });
}

let watcher: fs.FSWatcher;

let remotePromise: { resolve: () => void; reject: (err: Error) => void };

// enabling/disableing sync of the persistors needs to happen in main process
// but the events that trigger it happen in the renderer, so we have to use
// ipcs to send the instruction and to return the result.
function sendStartStopSync(enable: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    remotePromise = { resolve, reject };
    ipcRenderer.send("plugin-sync", enable);
  });
}

function stopSync(): Promise<void> {
  if (process.type === "renderer") {
    return sendStartStopSync(false);
  }
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }

  return pluginPersistor.disable();
}

function startSyncRemote(api: types.IExtensionApi): Promise<void> {
  return sendStartStopSync(true).then(() => {
    const store = api.store;

    const gameDiscovery = selectors.currentGameDiscovery(store.getState());
    if (gameDiscovery === undefined || gameDiscovery.path === undefined) {
      return;
    }

    const gameId = selectors.activeGameId(store.getState());
    const game = util.getGame(gameId);
    if (game === undefined) {
      return;
    }
    const modPath = game.getModPaths(gameDiscovery.path)[""];
    if (modPath === undefined) {
      // can this even happen?
      log("error", "mod path unknown", {
        discovery: nodeUtil.inspect(
          selectors.currentGameDiscovery(store.getState()),
        ),
      });
      return;
    }
    // watch the mod directory. if files change, that may mean our plugin list
    // changed, so refresh
    try {
      watcher = fs.watch(modPath, {}, (evt: string, fileName: string) => {
        if (evt !== "rename") {
          // only react to file creation or delete
          return;
        }

        if (deploying) {
          // during deployment we expect plugins to be added constantly so don't autosort now,
          // it has to be triggered upon finishing deployment
          return;
        }

        if (
          pluginExtensions(gameId).indexOf(
            path.extname(fileName).toLowerCase(),
          ) === -1
        ) {
          // ignore non-plugins
          return;
        }

        // ok, meta data of a plugin file changed but that could still just be the filetime
        // being changed by the persistor. So check if the file was actually created or removed,
        // compared to our last refresh
        fs.statAsync(path.join(modPath, fileName))
          .then(() => true)
          .catch(() => false)
          .then((exists) => {
            const pluginId = fileName.toLowerCase();
            const state = store.getState();
            const known =
              state.loadOrder[pluginId] !== undefined &&
              state.session.plugins.pluginList?.[pluginId] !== undefined;
            if (exists !== known) {
              if (refreshTimer !== undefined) {
                clearTimeout(refreshTimer);
              }

              refreshTimer = setTimeout(() => {
                updateCurrentProfile(api);
                refreshTimer = undefined;
              }, 500);
            }
          });
      });
      watcher.on("error", (error) => {
        log("warn", "failed to watch mod directory", { modPath, error });
      });
    } catch (err) {
      api.showErrorNotification("Failed to watch mod directory", err, {
        allowReport: err.code !== "ENOENT",
      });
    }
  });
}

function startSync(api: types.IExtensionApi): Promise<void> {
  if (process.type === "renderer") {
    return startSyncRemote(api);
  }
  const store = api.store;

  // start with a clean slate
  store.dispatch(setPluginOrder([], false));

  const gameId = selectors.activeGameId(store.getState());

  let prom: Promise<void> = Promise.resolve();

  if (pluginPersistor !== undefined) {
    prom = pluginPersistor.loadFiles(gameId);
  }

  if (userlistPersistor !== undefined) {
    prom = prom.then(() => userlistPersistor.loadFiles(gameId));
  }

  if (masterlistPersistor !== undefined) {
    prom = prom.then(() => masterlistPersistor.loadFiles(gameId));
  }

  return prom;
}

function testPluginsLocked(gameMode: string): Promise<types.ITestResult> {
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const filePath = path.join(pluginPath(gameMode), "plugins.txt");
  return new Promise<types.ITestResult>((resolve, reject) => {
    access(filePath, constants.W_OK, (err) => {
      if (err && err.code === "EPERM") {
        const res: types.ITestResult = {
          description: {
            short: "plugins.txt is write protected",
            long:
              "This file is used to control which plugins the game uses and while it's " +
              "write protected Vortex will not be able to enable or disable plugins.\n" +
              'If you click "fix" the file will be marked writable.',
          },
          severity: "error",
          automaticFix: () => fs.chmodAsync(filePath, parseInt("0777", 8)),
        };

        resolve(res);
      } else {
        resolve();
      }
    });
  });
}

function testMissingGroupsImpl(
  t: TranslationFunction,
  store: Redux.Store<IStateEx>,
): Promise<types.ITestResult> {
  const state = store.getState();
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const userlistGroups = state.userlist.groups || [];

  // all known groups
  const groups = new Set<string>(
    [].concat(
      (state.masterlist.groups || []).map((group) => group.name),
      userlistGroups.map((group) => group.name),
    ),
  );

  // all used groups
  const usedGroups = Array.from(
    new Set(
      [].concat(
        ...userlistGroups.map((group) => group.after || []),
        (state.userlist.plugins || [])
          .filter((plugin) => plugin.group !== undefined)
          .map((plugin) => plugin.group),
      ),
    ),
  );

  const missing = usedGroups.filter((group) => !groups.has(group));

  // nothing found => everything good
  if (missing.length === 0) {
    return Promise.resolve(undefined);
  }

  const res: types.ITestResult = {
    description: {
      short: "Invalid group rules",
      long: t(
        "Your userlist refers to groups that don't exist: {{missing}}[br][/br]" +
          "The most likely reason is that the masterlist has changed and dropped " +
          "the group.[br][/br]" +
          "This can be fixed automatically by removing all references to these groups.",
        {
          replace: {
            missing,
          },
        },
      ),
    },
    severity: "error",
    automaticFix: () => {
      const missingSet = new Set<string>(missing);
      (state.userlist.plugins || [])
        .filter(
          (plugin) =>
            plugin.group !== undefined && missingSet.has(plugin.group),
        )
        .forEach((plugin) => {
          store.dispatch(setGroup(plugin.name, undefined));
        });
      userlistGroups.forEach((group) => {
        (group.after || [])
          .filter((after) => missingSet.has(after))
          .forEach((after) => {
            store.dispatch(removeGroupRule(group.name, after));
          });
      });
      return Promise.resolve();
    },
  };
  return Promise.resolve(res);
}

function testMissingGroups(
  t: TranslationFunction,
  store: Redux.Store<IStateEx>,
  tries: number = 10,
): Promise<types.ITestResult> {
  return Promise.delay(100 * (10 - tries)).then(() => {
    const state = store.getState();
    return state.userlist.__isLoaded && state.masterlist.__isLoaded
      ? testMissingGroupsImpl(t, store)
      : tries > 0
        ? testMissingGroups(t, store, tries - 1)
        : Promise.resolve(undefined);
  });
}

function testUserlistInvalid(
  t: TranslationFunction,
  state: IStateEx,
): Promise<types.ITestResult> {
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const userlist: ILOOTList = state.userlist;
  const names = new Set<string>();

  if (userlist === undefined || userlist.plugins === undefined) {
    return Promise.resolve(undefined);
  }

  // search for duplicate plugin entries
  const duplicate = (userlist.plugins || []).find((iter) => {
    if (iter === null || [null, undefined].indexOf(iter.name) !== -1) {
      return false;
    }
    const name = iter.name.toUpperCase();
    if (names.has(name)) {
      return true;
    }
    names.add(name);
    return false;
  });
  if (duplicate !== undefined) {
    const userlistPath = path.join(
      util.getVortexPath("userData"),
      gameMode,
      "userlist.yaml",
    );
    return Promise.resolve({
      description: {
        short: "Duplicate entries",
        long: t(
          'Your userlist contains multiple entries for "{{name}}". ' +
            "This is not allowed and Vortex shouldn't create entries like that, " +
            "although earlier versions may have.\n" +
            'Please close vortex and remove duplicate entries from "{{userlistPath}}".',
          {
            replace: {
              name: duplicate.name,
              userlistPath,
            },
          },
        ),
      },
      severity: "warning" as types.ProblemSeverity,
    });
  }

  // search for duplicate after rules
  let duplicateAfter: string | ILootReference;
  const plugin = (userlist.plugins || []).find((iter) => {
    duplicateAfter = (iter.after || []).find(
      (val, idx) => iter.after.indexOf(val, idx + 1) !== -1,
    );
    return duplicateAfter !== undefined;
  });
  if (plugin !== undefined) {
    const userlistPath = path.join(
      util.getVortexPath("userData"),
      gameMode,
      "userlist.yaml",
    );
    return Promise.resolve({
      description: {
        short: "Duplicate dependencies",
        long: t(
          'Your userlist contains multiple identical "{{plugin}} after {{reference}}"' +
            "rules. LOOT will not be able to sort plugins with this userlist.\n" +
            "To fix this, please close vortex and remove duplicate entries from " +
            '"{{userlistPath}}".',
          {
            replace: {
              plugin: plugin.name,
              reference:
                typeof duplicateAfter === "string"
                  ? duplicateAfter
                  : duplicateAfter.name,
              userlistPath,
            },
          },
        ),
      },
      severity: "warning" as types.ProblemSeverity,
    });
  }
  return Promise.resolve(undefined);
}

function testMasterlistOutdated(
  api: types.IExtensionApi,
  infoCache?: PluginInfoCache,
): Promise<types.ITestResult> {
  const state = api.store.getState();
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }
  return new Promise<types.ITestResult>((resolve, reject) =>
    isMasterlistOutdated(api, gameMode, masterlistFilePath(gameMode))
      .then((isOutdated) => {
        if (isOutdated) {
          api.events.emit("restart-helpers");
        }
        return resolve(undefined);
      })
      .catch(reject),
  );
}

function testExceededPluginLimit(
  api: types.IExtensionApi,
  infoCache: PluginInfoCache,
): Promise<types.ITestResult> {
  const { translate, store } = api;
  const state = store.getState();
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }
  const loadOrder = util.getSafe(state, ["loadOrder"], {});
  const pluginList = state.session.plugins.pluginList ?? {};
  const plugins = Object.keys(pluginList).reduce((accum, key) => {
    if (util.getSafe(loadOrder, [key, "enabled"], false)) {
      let isLight;
      try {
        isLight = infoCache.getInfo(pluginList[key].filePath).isLight;
      } catch (err) {
        // We won't log this as the error will most definitely
        //  be raised somewhere else -> nop
        isLight = false;
      }
      accum[key] = { ...pluginList[key], isLight };
    }
    return accum;
  }, {});

  const isValid = (id: string) => {
    const plugin = plugins[id];
    return plugin?.deployed || plugin?.isNative;
  };

  const regular = Object.keys(plugins).filter(
    (id) => isValid(id) && !plugins[id].isLight,
  );
  const light = Object.keys(plugins).filter(
    (id) => isValid(id) && plugins[id].isLight,
  );
  const medium = Object.keys(plugins).filter(
    (id) => isValid(id) && plugins[id].isMedium,
  );

  const eslGame = supportsESL(gameMode);
  const mediumGame = supportsMediumMasters(gameMode);
  const regLimit = mediumGame ? 253 : eslGame ? 254 : 255;
  return regular.length > regLimit || medium.length > 256 || light.length > 4096
    ? Promise.resolve({
        description: {
          short: "You've exceeded the plugin limit for your game",
          long: translate(
            "Plugins shouldn't exceed mod index {{maxIndex}} for a total of {{count}} " +
              "plugins (including base game and DLCs) as the game will behave oddly otherwise. " +
              "Please disable or attempt to mark plugins as light (if applicable) " +
              "in the Plugins page",
            {
              replace: {
                maxIndex: mediumGame ? "0xFC" : eslGame ? "0xFD" : "0xFE",
                count: regLimit,
              },
            },
          ),
        },
        severity: "warning" as types.ProblemSeverity,
      })
    : Promise.resolve(undefined);
}

interface IESPInfo {
  isLight: boolean;
  masterList: string[];
}

// TODO: This should be asynchronous but that would make the calling code more complex
//   and I was worried about breaking something in a patch release.
//   Also: In an ideal world this information would be shared with the ui components
//   instead of duplicating the work
class PluginInfoCache {
  private mCache: {
    [id: string]: { lastModified: number; lastINO: bigint; info: IESPInfo };
  } = {};
  private mAPI: types.IExtensionApi;
  constructor(api: types.IExtensionApi) {
    this.mAPI = api;
  }

  public getInfo(filePath: string): IESPInfo {
    const id = this.fileId(filePath);
    let mtime: number;
    let ino: bigint;
    try {
      const stat = fs.statSync(filePath, { bigint: true });
      mtime = Number(stat.mtimeMs);
      ino = stat.ino;
    } catch (err) {
      mtime = Date.now();
    }

    const activeGameMode = selectors.activeGameId(this.mAPI.getState());
    if (
      this.mCache[id] === undefined ||
      mtime !== this.mCache[id].lastModified ||
      ino !== this.mCache[id].lastINO
    ) {
      const info = new ESPFile(filePath, activeGameMode);
      this.mCache[id] = {
        lastModified: mtime,
        lastINO: ino,
        info: {
          isLight: info.isLight,
          masterList: info.masterList,
        },
      };
    }

    return this.mCache[id].info;
  }

  private fileId(filePath: string): string {
    return path.basename(filePath).toUpperCase();
  }
}

function testTriggerSort(api: types.IExtensionApi): Promise<types.ITestResult> {
  return new Promise<types.ITestResult>((resolve, reject) => {
    api.onAsync("did-deploy", async () => {
      await new Promise((res) => setTimeout(res, 2000));
      api.events.emit("autosort-plugins", true, (err: Error) => resolve);
    });
  });
}

function testMissingMasters(
  api: types.IExtensionApi,
  infoCache: PluginInfoCache,
): Promise<types.ITestResult> {
  const { translate, store } = api;
  const state = store.getState();
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const pluginList = state.session.plugins.pluginList ?? {};
  const natives = new Set<string>(nativePlugins(gameMode));
  const loadOrder: { [plugin: string]: ILoadOrder } = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
    (plugin: string) => loadOrder[plugin].enabled || natives.has(plugin),
  );
  const pluginDetails = enabledPlugins
    .filter((name: string) => pluginList[name] !== undefined)
    .map((plugin) => {
      try {
        return {
          name: plugin,
          masterList: infoCache.getInfo(pluginList[plugin].filePath).masterList,
        };
      } catch (err) {
        log("warn", "failed to parse esp file", {
          name: pluginList[plugin].filePath,
          err: err.message,
        });
        return { name: plugin, masterList: [] };
      }
    });

  const activePlugins = new Set<string>(
    pluginDetails.map((plugin) => plugin.name),
  );

  const broken = pluginDetails.reduce((prev, plugin) => {
    const missing = plugin.masterList.filter(
      (requiredMaster) => !activePlugins.has(requiredMaster.toLowerCase()),
    );
    const oldWarn = util.getSafe(
      state,
      [
        "session",
        "plugins",
        "pluginList",
        plugin.name,
        "warnings",
        "missing-master",
      ],
      false,
    );
    const newWarn = missing.length > 0;
    if (oldWarn !== newWarn) {
      store.dispatch(
        updatePluginWarnings(plugin.name, "missing-master", newWarn),
      );
    }

    if (missing.length > 0) {
      prev[plugin.name] = missing;
    }
    return prev;
  }, {});

  if (Object.keys(broken).length === 0) {
    return Promise.resolve(undefined);
  } else {
    const link = (pluginName: string) => {
      return `[link="cb://showplugin/${pluginName}"]${pluginName}[/link]`;
    };
    return Promise.resolve({
      description: {
        short: "Missing Masters",
        long:
          translate(
            "Some of the enabled plugins depend on others that are not enabled:",
          ) +
          "[table][tbody]" +
          Object.keys(broken)
            .map((plugin) => {
              const missing = broken[plugin].map(link).join("[br][/br]");
              const detail = pluginList[plugin];
              const name =
                detail !== undefined ? path.basename(detail.filePath) : plugin;
              return (
                "[tr]" +
                [link(name), translate("depends on"), missing]
                  .map((iter) => `[td]${iter}[/td]`)
                  .join() +
                "[/tr]" +
                "[tr][/tr]"
              );
            })
            .join("\n") +
          "[/tbody][/table]",
        context: {
          callbacks: {
            showplugin: (pluginName: string) => {
              // have to update state and gameMode as they may have changed since the
              // message was generated
              const stateNow: types.IState = store.getState();
              const gameModeNow = selectors.activeGameId(stateNow);
              if (gameSupported(gameModeNow)) {
                api.events.emit("show-main-page", "gamebryo-plugins");
                store.dispatch(
                  actions.setAttributeFilter(
                    "gamebryo-plugins",
                    "name",
                    pluginName,
                  ),
                );
              }
            },
          },
        },
      },
      severity: "warning" as types.ProblemSeverity,
    });
  }
}

function testRulesUnfulfilled(
  api: types.IExtensionApi,
): Promise<types.ITestResult> {
  const { translate: t, store } = api;

  const state = store.getState();
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const pluginInfo: { [id: string]: IPluginCombined } =
    state.session.plugins?.pluginInfo || {};

  const discovery = selectors.discoveryByGame(state, gameMode);

  const natives = new Set<string>(nativePlugins(gameMode));
  const loadOrder: { [plugin: string]: ILoadOrder } = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
    (plugin: string) =>
      pluginInfo[plugin] !== undefined &&
      (loadOrder[plugin].enabled || natives.has(plugin)),
  );

  interface IEntry {
    left: string;
    right: string;
  }

  const depName = (input: string | ILootReference): string => {
    if (typeof input === "string") {
      return input;
    } else {
      return input.name;
    }
  };

  interface ICheckEntry {
    display: string;
    refs: string[];
  }
  interface ICheckMap {
    [key: string]: ICheckEntry;
  }
  const reqCheck: ICheckMap = {};
  const incCheck: ICheckMap = {};

  const addCheck = (
    target: ICheckMap,
    source: string,
    entry: ILootReference,
  ) => {
    if (typeof entry !== "string" && entry.condition !== undefined) {
      // evaluation of condition not supported atm
      // return;
    }
    const name = depName(entry);
    const id = name.toLowerCase();
    util.setdefault(target, id, { display: name, refs: [] }).refs.push(source);
    // the loot api returns the regular file name as a fallback if no display name is specified
    // in the user-/masterlist - without escaping characters that may be special in markdown.
    if (!!entry["display"] && entry["display"] !== name) {
      target[id].display = markdownToBBCode(entry["display"]);
    }
  };

  // for each enabled plugin, go through their list of required and incompatble files.
  enabledPlugins.forEach((pluginId: string) => {
    (pluginInfo[pluginId]?.requirements || []).forEach((req) =>
      addCheck(reqCheck, pluginId, req),
    );
    (pluginInfo[pluginId]?.incompatibilities || []).forEach((inc) =>
      addCheck(incCheck, pluginId, inc),
    );
  });

  const pluginsSet = new Set(enabledPlugins);

  const required: IEntry[] = [];
  const incompatible: IEntry[] = [];

  // it's not quite clear to me how the requirements/incompatibilities from LOOT are
  // evaluated. It definitively checks for the existence of required files, so fulfilled
  // requirements aren't listed in reqCheck at this points.
  // Otoh I do get "incompatibilities" entries for plugins that aren't installed.
  // This meaning we still have to check again to ensure we're not producing false positives but
  // since I don't know where the inconsistency in LOOT comes from this may be doing redundant
  // checks.

  const dataPath = gameDataPath(gameMode);
  const exists = (id: string): Promise<boolean> =>
    [".esp", ".esl", ".esm"].includes(path.extname(id))
      ? Promise.resolve(pluginsSet.has(id))
      : fs
          .statAsync(path.resolve(dataPath, id))
          .then(() => true)
          .catch((err) => false);

  return Promise.map(Object.keys(reqCheck), (reqId) =>
    exists(reqId).then((existsRes) => {
      if (!existsRes) {
        required.push(
          ...reqCheck[reqId].refs.map((ref) => ({
            left: ref,
            right: reqCheck[reqId].display,
          })),
        );
      }
    }),
  )
    .then(() =>
      Promise.map(Object.keys(incCheck), (incId) =>
        exists(incId).then((existsRes) => {
          if (existsRes) {
            incompatible.push(
              ...incCheck[incId].refs.map((ref) => ({
                left: ref,
                right: incCheck[incId].display,
              })),
            );
          }
        }),
      ),
    )
    .then(() => {
      if (required.length === 0 && incompatible.length === 0) {
        return Promise.resolve(undefined);
      } else {
        const reqLine = (left: string, right: string) =>
          `[tr][td]${left}[/td][td]${t("requires")}[/td][td]${right}[/td][/tr]`;
        const incLine = (left: string, right: string) =>
          `[tr][td]${left}[/td][td]${t("is incompatible with")}[/td][td]${right}[/td][/tr]`;

        return Promise.resolve<types.ITestResult>({
          description: {
            short: t("Plugin dependencies unfulfilled"),
            long:
              t(
                "Some of the enabled plugins have dependencies or incompatibilities " +
                  "that are not obeyed in your current setup",
              ) +
              ":[table][tbody]" +
              required.map((iter) => reqLine(iter.left, iter.right)) +
              "[tr][/tr]" +
              incompatible.map((iter) => incLine(iter.left, iter.right)) +
              "[/tbody][/table]",
            localize: false,
          },
          severity: "warning" as types.ProblemSeverity,
          onRecheck: () => {
            return new Promise((resolve, reject) => {
              api.events.emit(
                "plugin-details",
                gameMode,
                Object.keys(state.session.plugins.pluginList ?? {}),
                resolve,
              );
            });
          },
        } as any);
      }
    });
}

function notifyMultiplePlugins(
  api: types.IExtensionApi,
  mod: types.IMod,
  profile: types.IProfile,
  plugins: string[],
) {
  const t = api.translate;
  const { store } = api;
  const modName = util.renderModName(mod, { version: false });
  api.sendNotification({
    id: `multiple-plugins-${mod.id}`,
    type: "info",
    message: t('The mod "{{ modName }}" contains multiple plugins', {
      replace: { modName },
      ns: NAMESPACE,
    }),
    replace: {
      modName,
      modId: mod.id,
      tag: mod.attributes?.referenceTag,
    },
    actions: [
      {
        title: "Show",
        action: (dismiss) => {
          const stateNow: types.IState = store.getState();
          const gameModeNow = selectors.activeGameId(stateNow);
          if (gameModeNow === profile.gameId) {
            api.events.emit("show-main-page", "gamebryo-plugins");
            store.dispatch(
              actions.setAttributeVisible("gamebryo-plugins", "modName", true),
            );
            store.dispatch(
              actions.setAttributeFilter(
                "gamebryo-plugins",
                "modName",
                modName,
              ),
            );
          } else {
            api.sendNotification({
              type: "info",
              message: t(
                'Please activate "{{ gameId }}" to enable plugins manually',
                {
                  replace: { gameId: profile.gameId },
                  ns: NAMESPACE,
                },
              ),
            });
          }

          dismiss();
        },
      },
      {
        title: "Enable all",
        action: (dismiss) => {
          plugins.forEach((plugin) =>
            api.store.dispatch(setPluginEnabled(plugin, true)),
          );
          dismiss();
        },
      },
    ],
  });
}

function onDidDeploy(
  api: types.IExtensionApi,
  profileId: string,
): Promise<void> {
  const state: types.IState = api.getState();
  const profile = state.persistent.profiles[profileId];
  const activeGameId = selectors.activeGameId(state);
  const discovery = selectors.discoveryByGame(state, activeGameId);
  return discovery?.path != null &&
    profile?.gameId === activeGameId &&
    gameSupported(profile?.gameId)
    ? updatePluginList(api.store, profile.modState, profile.gameId)
        .then(
          () =>
            new Promise((resolve, reject) => {
              const pluginList = util.getSafe(
                api.getState(),
                ["session", "plugins", "pluginList"],
                {},
              );
              api.events.emit(
                "plugin-details",
                profile.gameId,
                Object.keys(pluginList ?? {}),
                resolve,
              );
            }),
        )
        .then(() => util.delay(500)) // wait a bit for the plugin details to be updated
        .then(() => api.events.emit("autosort-plugins", false))
        .then(() => Promise.resolve())
    : Promise.resolve();
}

function sanitizeForIPC(obj: any) {
  // Omit functions and non-serializeable properties from gameData before sending over IPC
  const sanitizedGameData = Object.fromEntries(
    Object.entries(obj).filter(
      ([key, value]) =>
        typeof value !== "function" && typeof value !== "symbol",
    ),
  );
  return JSON.parse(JSON.stringify(sanitizedGameData));
}

function init(context: IExtensionContextExt) {
  const setPluginLight = (id: string, enable: boolean) => {
    const state: IStateEx = context.api.getState();
    const profile = selectors.activeProfile(state);
    const plugin: IPlugin = state.session.plugins.pluginList[id];
    if (plugin === undefined) {
      return false;
    }

    const esp = new ESPFile(plugin.filePath, profile.gameId);
    esp.setLightFlag(enable);
    context.api.ext.addToHistory("plugins", {
      type: "plugin-eslified",
      gameId: profile.gameId,
      data: {
        id,
        enable,
      },
    });
    forceListUpdate[id] = Date.now();
  };

  const history = new PluginHistory(
    context.api,
    makeSetPluginGhost(context.api),
    setPluginLight,
  );

  register(context, setPluginLight);
  initPersistor(context);

  context.registerHistoryStack("plugins", history);

  context
    // Similar to once, we need to initGameSupport from the get-go or the pluginPersistor
    //  will not use the updated appDataPath values (given that the gameSupport object
    //  wasn't previously initialized for the main application thread)
    .onceMain(() =>
      initGameSupport(context.api).then(() => {
        ipcMain.on(
          "plugin-sync",
          (event: Electron.IpcMainEvent, enabled: boolean) => {
            const promise = enabled ? startSync(context.api) : stopSync();
            promise
              .then(() => {
                if (!event.sender.isDestroyed()) {
                  event.sender.send("plugin-sync-ret", null);
                }
              })
              .catch((err) => {
                if (!event.sender.isDestroyed()) {
                  event.sender.send("plugin-sync-ret", {
                    message: err.message,
                    stack: err.stack,
                  });
                }
              });
          },
        );
        ipcMain.on("did-update-masterlist", () => {
          if (masterlistPersistor !== undefined) {
            const gameId = selectors.activeGameId(context.api.store.getState());
            masterlistPersistor.loadFiles(gameId);
          }
        });
        ipcMain.on(
          "gamebryo-set-known-plugins",
          (
            event: Electron.Event,
            knownPlugins: { [pluginId: string]: string },
          ) => {
            pluginPersistor.setKnownPlugins(knownPlugins);
          },
        );

        ipcMain.on(
          "gamebryo-gamesupport-sync-state",
          (event, gameMode: string, gameData: IGameSupport) => {
            syncGameSupport(gameMode, gameData);
          },
        );
      }),
    );

  context
    // first thing on once, init game support for the previously discovered games
    .once(() =>
      initGameSupport(context.api).then(() => {
        const store = context.api.store;
        const current = getGameSupport();
        Object.entries(current).forEach(([gameMode, gameData]) => {
          ipcRenderer.send(
            "gamebryo-gamesupport-sync-state",
            gameMode,
            sanitizeForIPC(gameData),
          );
        });

        ipcRenderer.on("plugin-sync-ret", (event, error: Error) => {
          if (remotePromise !== undefined) {
            if (error !== null) {
              remotePromise.reject(error);
            } else {
              remotePromise.resolve();
            }
            remotePromise = undefined;
          }
        });

        context.api.setStylesheet(
          "plugin-management",
          path.join(__dirname, "plugin_management.scss"),
        );

        loot = new LootInterface(context.api);

        let pluginsChangedQueued = false;

        context.api.events.on(
          "will-install-dependencies",
          (
            gameId: string,
            modId: string,
            recommendations: boolean,
            onCancel: () => void,
          ) => {
            const state: types.IState = context.api.getState();
            if (!gameSupported(gameId)) {
              return;
            }
            const mod = state.persistent.mods[gameId][modId];
            if (mod?.type === "collection") {
              // This is the perfect time to update the user's masterlist if it's needed as he
              //  won't be allowed to sort or change plugins while the dependencies
              //  are being installed - masterlist will be fully updated and persisted by the
              //  time the dependencies are installed.
              testMasterlistOutdated(context.api).catch((err) => null);
            }
          },
        );

        context.api.onAsync("will-deploy", () => {
          deploying = true;
          return Promise.resolve();
        });

        context.api.events.on(
          "collection-postprocess-complete",
          (gameId: string, collectionModId: string) => {
            if (!gameSupported(gameId)) {
              return;
            }
            const profileId = selectors.lastActiveProfileForGame(
              context.api.getState(),
              gameId,
            );
            if (!profileId) {
              return;
            }
            onDidDeploy(context.api, profileId);
          },
        );

        // this handles the case that the content of a profile changes
        context.api.onAsync(
          "did-deploy",
          (profileId, deployment, progressCB, deployOptions) => {
            deploying = false;
            if (pluginsChangedQueued) {
              pluginsChangedQueued = false;
              context.api.events.emit(
                "trigger-test-run",
                "plugins-changed",
                500,
              );
            }
            const activeCollection = selectors.getCollectionActiveSession(
              context.api.getState(),
            );
            if (
              activeCollection ||
              deployOptions?.isCollectionPostprocessCall
            ) {
              // handled in 'collection-postprocess-complete' event
              return Promise.resolve();
            }
            return onDidDeploy(context.api, profileId);
          },
        );

        context.api.onAsync("did-purge", (profileId: string) => {
          return onDidDeploy(context.api, profileId);
        });

        context.api.onStateChange(["loadOrder"], () => {
          if (deploying) {
            pluginsChangedQueued = true;
          } else {
            context.api.events.emit("trigger-test-run", "plugins-changed", 500);
          }
        });

        context.api.onStateChange(
          ["settings", "gameMode", "discovered"],
          (previous, current) => {
            initGameSupport(context.api).then(() => null);
          },
        );

        context.api.onStateChange(
          ["session", "base", "mainPage"],
          (previous, current) => {
            if (previous !== current && current === "gamebryo-plugins") {
              // TODO: We could theoretically apply filters here to display the plugins that were added.
              context.api.store.dispatch(clearNewPluginCounter());
            }
          },
        );

        context.api.events.on(
          "set-plugin-list",
          (newPlugins: string[], setEnabled?: boolean) => {
            const state = context.api.store.getState();
            store.dispatch(
              updatePluginOrder(
                newPlugins.map((name) => name.toLowerCase()),
                setEnabled !== false,
                state.settings.plugins.autoEnable,
              ),
            );
          },
        );

        context.api.events.on(
          "profile-will-change",
          (
            nextProfileId: string,
            enqueue: (cb: () => Promise<void>) => void,
          ) => {
            if (nextProfileId === undefined) {
              context.api.store.dispatch(setPluginList(undefined));
              return;
            }
            const state = context.api.store.getState();
            const gameMode = selectors.activeGameId(state);
            const nextProfile = selectors.profileById(state, nextProfileId);
            if (nextProfile !== undefined && nextProfile.gameId !== gameMode) {
              context.api.store.dispatch(setPluginList(undefined));
            }
            enqueue(() => {
              return stopSync()
                .then(() =>
                  userlistPersistor !== undefined
                    ? userlistPersistor.disable()
                    : Promise.resolve(),
                )
                .then(() =>
                  masterlistPersistor !== undefined
                    ? masterlistPersistor.disable()
                    : Promise.resolve(),
                )
                .then(() => loot.wait())
                .catch((err) => {
                  context.api.showErrorNotification(
                    "Failed to change profile",
                    err,
                  );
                });
            });
          },
        );

        context.api.events.on("profile-did-change", (newProfileId: string) => {
          const current = getGameSupport();
          Object.entries(current).forEach(([gameMode, gameData]) => {
            ipcRenderer.send(
              "gamebryo-gamesupport-sync-state",
              gameMode,
              sanitizeForIPC(gameData),
            );
          });
          const newProfile = util.getSafe(
            store.getState(),
            ["persistent", "profiles", newProfileId],
            undefined,
          );

          if (newProfile !== undefined && gameSupported(newProfile.gameId)) {
            updatePluginList(store, newProfile.modState, newProfile.gameId)
              .then(() => startSync(context.api))
              .catch((err) => {
                context.api.showErrorNotification(
                  "Failed to change profile",
                  err,
                );
              });
          }
        });

        context.api.events.on("did-update-masterlist", () => {
          ipcRenderer.send("did-update-masterlist");
        });

        context.api.events.on(
          "mod-enabled",
          (profileId: string, modId: string) => {
            /* when enabling a mod we automatically enable its plugin, if there is (exactly) one.
             * if there are more the user gets a notification if he wants to enable all. */
            const state: types.IState = context.api.store.getState();
            const currentProfile = selectors.activeProfile(state);
            if (currentProfile === undefined) {
              return;
            }

            if (
              profileId === currentProfile.id &&
              gameSupported(currentProfile.gameId)
            ) {
              const mod: types.IMod =
                state.persistent.mods[currentProfile.gameId][modId];
              if (mod === undefined) {
                log("error", "newly activated mod not found", {
                  profileId,
                  modId,
                });
                return;
              }
              fs.readdirAsync(
                path.join(selectors.installPath(state), mod.installationPath),
              )
                .catch((err) => {
                  if (err.code === "ENOENT") {
                    context.api.showErrorNotification(
                      "A mod could no longer be found on disk. Please don't delete mods manually " +
                        "but uninstall them through Vortex.",
                      err,
                      { allowReport: false },
                    );
                    context.api.store.dispatch(
                      actions.removeMod(currentProfile.gameId, modId),
                    );
                    return Promise.reject(
                      new util.ProcessCanceled("mod was deleted"),
                    );
                  } else {
                    return Promise.reject(err);
                  }
                })
                .then((files) => {
                  const plugins = files
                    .filter(
                      (fileName) =>
                        pluginExtensions(currentProfile.gameId).indexOf(
                          path.extname(fileName).toLowerCase(),
                        ) !== -1,
                    )
                    .map((fileName) => path.basename(fileName, GHOST_EXT));
                  if (plugins.length === 1) {
                    const batched = [
                      setPluginEnabled(plugins[0], true),
                      incrementNewPluginCounter(1),
                    ];
                    util.batchDispatch(context.api.store, batched);
                  } else if (plugins.length > 1) {
                    if (mod.attributes?.enableallplugins === true) {
                      const batched: any = plugins.map((plugin) =>
                        setPluginEnabled(plugin, true),
                      );
                      batched.push(incrementNewPluginCounter(batched.length));
                      util.batchDispatch(context.api.store, batched);
                    } else {
                      notifyMultiplePlugins(
                        context.api,
                        mod,
                        currentProfile,
                        plugins,
                      );
                    }
                  }
                })
                .catch(util.ProcessCanceled, () => undefined)
                .catch(util.UserCanceled, () => undefined)
                .catch((err) => {
                  context.api.showErrorNotification("Failed to read mod", err);
                });
            }
          },
        );

        history.init();
      }),
    );

  return true;
}

export default init;
