import { access, constants } from "fs";
import { stat as fsStat } from "fs/promises";
import * as path from "path";
import * as nodeUtil from "util";

import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";
import { VortexError } from "@vortex/shared/errors";
import Bluebird from "bluebird";
import type I18next from "i18next";
import type * as Redux from "redux";
import { createSelector } from "reselect";

import { log } from "../../logging";
import ReduxProp from "../../ReduxProp";
import type { IDialogResult } from "../../types/IDialog";
import type {
  IErrorOptions,
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type { ITestResult, ProblemSeverity } from "../../types/ITestResult";
import { clearErrorContext } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import makeReactive from "../../util/makeReactive";
import opn from "../../util/opn";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, delay, setdefault } from "../../util/util";
import { currentGameDiscovery, discoveryByGame } from "../gamemode_management/selectors";
import { getGame } from "../gamemode_management/util/getGame";
import { installPathForGame } from "../mod_management/selectors";
import {
  activeGameId,
  activeProfile,
  lastActiveProfileForGame,
  profileById,
} from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
/* eslint-disable */
import { setPluginEnabled, setPluginOrder } from "./actions/loadOrder";
import { clearNewPluginCounter, setPluginFilePath, setPluginList } from "./actions/plugins";
import { clearUserlist, setGroup } from "./actions/userlist";
import { openGroupEditor, setCreateRule } from "./actions/userlistEdit";
import { testIncompatibleArchives } from "./archiveCheck";
import LootInterface from "./autosort";
import { startDeployWatcher, type IDeployWatcher } from "./deployWatcher";
import { ESPFile } from "./esp/ESPFile";
import { genLockIndexAttribute, onceIndexLock } from "./indexlock";
import { makeLootSortAsync } from "./lootSortAsync";
import { REDUCER_BINDINGS } from "./reducers/bindings";
import { GHOST_EXT } from "./statics";
import { IESPFile } from "./types/IESPFile";
import { ILOOTList, ILootReference } from "./types/ILOOTList";
import { IPluginLoadOrderEntry } from "./types/IPluginLoadOrderEntry";
import { IPlugin, IPluginCombined } from "./types/IPlugins";
import { IStateWithGamebryo } from "./types/IStateWithGamebryo";
import {
  gameDataPath,
  gameSupported,
  getGameSupport,
  IGameSupport,
  initGameSupport,
  minRevision,
  nativePlugins,
  pluginExtensions,
  pluginPath,
  revisionText,
  syncGameSupport,
  supportedGames,
  supportsBlueprintPlugins,
  supportsESL,
  supportsMediumMasters,
} from "./util/gameSupport";
import { missingGroupFixes } from "./util/groups";
import { LootPhase, lootErrorReporter } from "./util/LootErrorReporter";
import { isMasterlistOutdated, masterlistExists, masterlistFilePath } from "./util/masterlist";
import { markdownToBBCode } from "./util/mdtobb";
import { checkMissingMasters } from "./util/missingMasters";
import { handleModEnabled } from "./util/onModEnabled";
import { handleModInstalled } from "./util/onModInstalled";
import { handleSetPluginList } from "./util/onSetPluginList";
import PluginHistory from "./util/PluginHistory";
import PluginPersistor from "./util/PluginPersistor";
import { pluginLink, showPluginCallbacks } from "./util/showPlugin";
import { AMBIENT_ATTRIBUTES, SpanAttribute } from "./util/spanAttributes";
import toPluginId from "./util/toPluginId";
import { makeUpdatePluginList } from "./util/updatePluginList";
import UserlistPersistor from "./util/UserlistPersistor";
import Connector from "./views/Connector";
import GroupEditor from "./views/GroupEditor";
import { getPluginFlags } from "./views/PluginFlags";
import PluginList from "./views/PluginList";
import Settings from "./views/Settings";
import UserlistEditor from "./views/UserlistEditor";

type TranslationFunction = typeof I18next.t;

function renamePlugin(
  api: IExtensionApi,
  gameId: string,
  plugin: IPluginCombined,
  targetPath: string,
): Bluebird<void> {
  const renameProm = fs.renameAsync(plugin.filePath, targetPath);
  if (!plugin.modId) {
    return renameProm;
  } else {
    // if we have a corresponding mod we need to rename the file in the staging directory instead,
    // deployment will later figure out the file in the game directory
    const state = api.getState();
    const stagingPath = installPathForGame(state, gameId);
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

interface IExtensionContextExt extends IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string | (() => PromiseLike<string[]>)) => void;
}

let pluginPersistor: PluginPersistor;
let userlistPersistor: UserlistPersistor;
let masterlistPersistor: UserlistPersistor;
let loot: LootInterface;
let refreshTimer: NodeJS.Timeout;
let deployWatcher: IDeployWatcher = { isDeploying: () => false };

const updatePluginList = makeUpdatePluginList(() => pluginPersistor);

function makeSetPluginGhost(api: IExtensionApi) {
  return (pluginId: string, gameMode: string, ghosted: boolean, enabled: boolean) => {
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
const forceListUpdate = makeReactive({});

function register(
  context: IExtensionContextExt,
  setPluginLight: (id: string, enable: boolean) => void,
) {
  for (const { path: statePath, reducer } of REDUCER_BINDINGS) {
    context.registerReducer(statePath, reducer);
  }

  context.registerTableAttribute("gamebryo-plugins", genLockIndexAttribute(context.api));

  const pluginActivity = new ReduxProp(
    context.api,
    [["session", "base", "activity", "plugins"]],
    (activity: string[]) => activity !== undefined && activity.length > 0,
  );

  const isMaster = (filePath: string, flag: boolean, gameMode: string): boolean => {
    if (path.extname(filePath) === GHOST_EXT) {
      filePath = path.basename(filePath, GHOST_EXT);
    }
    const masterExts = supportsESL(gameMode) ? [".esm", ".esl"] : [".esm"];
    return flag || masterExts.indexOf(path.extname(filePath).toLowerCase()) !== -1;
  };

  const isMediumMaster = async (
    filePath: string,
    flag: boolean,
    gameMode: string,
  ): Promise<boolean> => {
    if (path.extname(filePath) === GHOST_EXT) {
      filePath = path.basename(filePath, GHOST_EXT);
    }
    const masterExts = [".esm"];
    const file = await ESPFile.open(filePath, gameMode);
    return (
      flag || (masterExts.indexOf(path.extname(filePath).toLowerCase()) !== -1 && file.isMedium)
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

  const openLOOTSite = () => opn("https://loot.github.io/").catch(() => null);

  const parseESPFile = async (filePath: string, gameMode: string): Promise<IESPFile> => {
    const fileInfo = await ESPFile.open(filePath, gameMode);
    return {
      isMaster: fileInfo.isMaster,
      isLight: fileInfo.isLight,
      isMedium: fileInfo.isMedium,
      isDummy: fileInfo.isDummy,
      isBlueprint: supportsBlueprintPlugins(gameMode) && fileInfo.isBlueprint,
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
  const enabledPlugins = createSelector(loadOrder, activeGameId, (order, gameId) => {
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
  });

  const pluginCounter = new ReduxProp(
    context.api,
    [["session", "plugins", "newlyAddedPlugins"]],
    (value: number) => (value > 0 ? value : undefined),
  );

  const installedPlugins = () => enabledPlugins(context.api.store.getState());
  context.registerMainPage("plugins", "Plugins", PluginList, {
    priority: 30,
    id: "gamebryo-plugins",
    hotkey: "E",
    group: "per-game",
    visible: () => {
      const state = context.api.store.getState();
      const gameMode = activeGameId(state);
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
      nativePlugins: gameSupported(activeGameId(context.api.store.getState()))
        ? nativePlugins(activeGameId(context.api.store.getState()))
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
      Bluebird.resolve([path.join(pluginPath(gameId), "plugins.txt")]),
    );
    context.registerProfileFile(gameId, () =>
      Bluebird.resolve([path.join(pluginPath(gameId), "loadorder.txt")]),
    );
  }

  context.registerProfileFeature(
    "local_loot_rules",
    "boolean",
    "connection",
    "LOOT Rules",
    "This profile has its own plugin rules and groups",
    () => gameSupported(activeGameId(context.api.store.getState())),
  );

  context.registerSettings("Workarounds", Settings, undefined, () => {
    const state = context.api.store.getState();
    const gameMode = activeGameId(state);
    return supportedGames().indexOf(gameMode) !== -1;
  });

  context.registerAPI(
    "lootSortAsync",
    makeLootSortAsync(context.api, {
      masterlistExists,
      downloadMasterlist: (gameMode) => loot.downloadMasterlist(gameMode),
      updatePluginList: (modState, gameId) => updatePluginList(context.api.store, modState, gameId),
      sortFiles: (pluginFilePaths) => loot.sortFiles(pluginFilePaths),
    }),
    { minArguments: 1 },
  );

  context.registerAction("gamebryo-plugin-icons", 100, "connection", {}, "Manage Rules", () => {
    context.api.store.dispatch(setCreateRule(undefined, undefined, undefined));
  });

  context.registerAction("gamebryo-plugin-icons", 105, "groups", {}, "Manage Groups", () => {
    context.api.store.dispatch(openGroupEditor(true));
  });

  context.registerAction("gamebryo-plugin-icons", 200, "history", {}, "History", () => {
    context.api.ext.showHistory?.("plugins");
  });

  context.registerAction("gamebryo-plugin-icons", 300, "undo", {}, "Reset Plugin Rules", () => {
    context.api
      .showDialog(
        "question",
        "Reset Plugin Rules",
        {
          text:
            "This will remove ALL custom plugin rules, plugin group assignments, " +
            "and custom groups. Only rules from the LOOT masterlist will remain.\n\n" +
            "This cannot be undone.",
        },
        [{ label: "Cancel" }, { label: "Reset" }],
      )
      .then((result: IDialogResult) => {
        if (result.action === "Reset") {
          const state: IStateWithGamebryo = context.api.store.getState();
          const userlist = state.userlist;
          // explicitly unset group assignments so the UI updates
          const unsetGroups = (userlist?.plugins ?? [])
            .filter((plugin) => plugin.group !== undefined)
            .map((plugin) => setGroup(plugin.name, undefined));
          batchDispatch(context.api.store, [...unsetGroups, clearUserlist()]);
          context.api.sendNotification({
            type: "success",
            message: "Plugin rules have been reset to defaults",
            displayMS: 3000,
          });
        }
      });
  });

  context.registerActionCheck(
    "GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED",
    (state: any, action: any) => {
      // Bit of a hack - we need to let the plugin persistor
      //  know that the plugin management is enabled for this profile.
      if (process.type === "renderer") {
        const { profileId, enabled } = action.payload;
        const profile = profileById(state, profileId);
        const currentState = getSafe(state, ["pluginManagementEnabled", profileId], false);
        if (currentState !== enabled) {
          if (enabled) {
            syncGameSupport(profile.gameId, getGameSupport()[profile.gameId]);
            startSync(context.api);
          } else {
            stopSync();
          }
        }
      }
      return undefined;
    },
  );

  context.registerActionCheck("ADD_USERLIST_RULE", (state: any, action: any) => {
    const { pluginId, reference, type } = action.payload;

    const plugin = (state.userlist.plugins ?? []).find((iter) => iter.name === pluginId);
    if (plugin !== undefined) {
      if ((plugin[type] || []).indexOf(reference) !== -1) {
        return `Duplicate rule "${pluginId} ${type} ${reference}"`;
      }
    }

    return undefined;
  });

  const pluginInfoCache = new PluginInfoCache(context.api);

  // Cross-extension API: lets other extensions (e.g. game-starfield) query
  // Blueprint-plugin status without depending on the ESP parser directly.
  //
  // Takes an absolute plugin file path so the lookup is self-contained — the
  // API never depends on Vortex's pluginList Redux state being populated, and
  // can be called at any point after gamemode activation.
  //
  // Returns false for non-Starfield game modes (supportsBlueprintPlugins gate),
  // for files the parser can't read, and for files whose TES4 header doesn't
  // set the Blueprint flag. Consumers should treat a thrown/non-boolean result
  // as a no-op and not assume anything about blueprint-ness.
  context.registerAPI(
    "isBlueprintPlugin",
    async (pluginFilePath: string): Promise<boolean> => {
      const gameMode = activeGameId(context.api.getState());
      if (!supportsBlueprintPlugins(gameMode)) {
        return false;
      }
      try {
        return (await pluginInfoCache.getInfo(pluginFilePath)).isBlueprint;
      } catch (err) {
        log("warn", "isBlueprintPlugin parse failed", {
          pluginFilePath,
          err: (err as Error).message,
        });
        return false;
      }
    },
    { minArguments: 1 },
  );

  context.registerTest("plugins-locked", "gamemode-activated", () =>
    testPluginsLocked(activeGameId(context.api.store.getState())),
  );
  const pluginMasters = async (filePath: string) =>
    (await pluginInfoCache.getInfo(filePath)).masterList;
  context.registerTest("master-missing", "gamemode-activated", () =>
    checkMissingMasters(context.api, pluginMasters),
  );
  context.registerTest("master-missing", "plugins-changed" as any, () =>
    checkMissingMasters(context.api, pluginMasters),
  );
  context.registerTest("blueprint-master", "gamemode-activated", () =>
    testBlueprintMasters(context.api, pluginInfoCache),
  );
  context.registerTest("blueprint-master", "plugins-changed" as any, () =>
    testBlueprintMasters(context.api, pluginInfoCache),
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
  context.registerTest("incompatible-mod-archives", "plugins-changed", () =>
    testIncompatibleArchives(context.api),
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
  const onError = (message: string, detail: Error, options?: IErrorOptions) => {
    context.api.showErrorNotification(message, detail, options);
  };

  // Initialize persistors in renderer process (where Redux store now lives)
  if (pluginPersistor === undefined) {
    pluginPersistor = new PluginPersistor(
      onError,
      () => context.api.store.getState().settings.plugins.autoSort,
    );
    pluginPersistor.setExternalChangeCallback(() =>
      context.api
        .showDialog(
          "question",
          "Plugin list changed outside Vortex",
          {
            text:
              "Another tool or the game changed the plugin list files. " +
              "Keep those changes or revert to the load order Vortex manages?",
          },
          [{ label: "Revert" }, { label: "Keep" }],
        )
        .then((result) => (result.action === "Keep" ? "keep" : "revert")),
    );
  }
  if (userlistPersistor === undefined) {
    userlistPersistor = new UserlistPersistor("userlist", onError);
  }
  if (masterlistPersistor === undefined) {
    masterlistPersistor = new UserlistPersistor("masterlist", onError);
  }

  context.registerPersistor("loadOrder", pluginPersistor);
  context.registerPersistor("userlist", userlistPersistor);
  context.registerPersistor("masterlist", masterlistPersistor);
}

/**
 * update the plugin list for the currently active profile
 */
function updateCurrentProfile(api: IExtensionApi): Bluebird<void> {
  const gameId = activeGameId(api.getState());

  if (!gameSupported(gameId)) {
    return Bluebird.resolve();
  }

  const profile = activeProfile(api.getState());
  if (profile === undefined) {
    log("warn", "no profile active");
    return Bluebird.resolve();
  }

  return new Bluebird<void>(async (resolve, reject) => {
    await updatePluginList(api.store, profile.modState, profile.gameId);
    const pluginList = getSafe(api.getState(), ["session", "plugins", "pluginList"], {});
    api.events.emit("plugin-details", profile.gameId, Object.keys(pluginList ?? {}), resolve);
  });
}

/**
 * swap the userlist.yaml file between profiles when the local_loot_rules
 * feature toggle is enabled. Called after persistors are disabled to prevent
 * stale writes.
 */
async function swapUserlistForProfile(
  oldProfile: IProfile | undefined,
  newProfile: IProfile | undefined,
): Promise<void> {
  const oldHasLocal = oldProfile?.features?.local_loot_rules === true;
  const newHasLocal = newProfile?.features?.local_loot_rules === true;

  if (!oldHasLocal && !newHasLocal) {
    return;
  }

  const gameId = oldProfile?.gameId ?? newProfile?.gameId;
  if (gameId === undefined) {
    return;
  }

  const userDataPath = getVortexPath("userData");
  const activeFile = path.join(userDataPath, gameId, "userlist.yaml");
  const globalBackup = path.join(userDataPath, gameId, "userlist.yaml.global");

  const getProfileDir = (profile: IProfile) =>
    path.join(userDataPath, gameId, "profiles", profile.id);
  const getProfileFile = (profile: IProfile) => path.join(getProfileDir(profile), "userlist.yaml");

  const copyIgnoringMissing = async (src: string, dest: string) => {
    try {
      await fs.copyAsync(src, dest, { noSelfCopy: true });
    } catch (err) {
      if (getErrorCode(err) !== "ENOENT") {
        throw err;
      }
    }
  };

  // save old profile's rules to its profile directory
  if (oldHasLocal && oldProfile?.pendingRemove !== true) {
    await fs.ensureDirAsync(getProfileDir(oldProfile));
    await copyIgnoringMissing(activeFile, getProfileFile(oldProfile));

    if (!newHasLocal) {
      // restore global backup
      await copyIgnoringMissing(globalBackup, activeFile);
    }
  }

  // load new profile's rules from its profile directory
  if (newHasLocal) {
    if (!oldHasLocal) {
      // back up the current global userlist
      await copyIgnoringMissing(activeFile, globalBackup);
    }

    try {
      await fs.statAsync(getProfileFile(newProfile));
      // profile has a saved copy — restore it
      await fs.copyAsync(getProfileFile(newProfile), activeFile, { noSelfCopy: true });
    } catch (err) {
      if (getErrorCode(err) === "ENOENT") {
        // first time: seed the profile dir from the current file
        await fs.ensureDirAsync(getProfileDir(newProfile));
        await copyIgnoringMissing(activeFile, getProfileFile(newProfile));
      } else {
        throw err;
      }
    }
  }
}

let watcher: fs.FSWatcher;

function stopSync(): Promise<void> {
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }
  for (const key of AMBIENT_ATTRIBUTES) {
    clearErrorContext(key);
  }

  if (pluginPersistor === undefined) {
    log("debug", "stopSync: pluginPersistor is undefined, resolving immediately");
    return Promise.resolve();
  }

  return pluginPersistor.disable();
}

function startSync(api: IExtensionApi): Promise<void> {
  const store = api.store;

  // start with a clean slate
  store.dispatch(setPluginOrder([], false));

  const gameId = activeGameId(store.getState());

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

  return prom.then(() => {
    const gameDiscovery = currentGameDiscovery(store.getState());
    if (gameDiscovery === undefined || gameDiscovery.path === undefined) {
      return;
    }

    const game = getGame(gameId);
    if (game === undefined) {
      return;
    }
    const modPath = game.getModPaths(gameDiscovery.path)[""];
    if (modPath === undefined) {
      // can this even happen?
      log("error", "mod path unknown", {
        discovery: nodeUtil.inspect(currentGameDiscovery(store.getState())),
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

        if (deployWatcher.isDeploying()) {
          // during deployment we expect plugins to be added constantly so don't autosort now,
          // it has to be triggered upon finishing deployment
          return;
        }

        if (pluginExtensions(gameId).indexOf(path.extname(fileName).toLowerCase()) === -1) {
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
            const pluginId = toPluginId(fileName);
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
        allowReport: getErrorCode(err) !== "ENOENT",
      });
    }
  });
}

function testPluginsLocked(gameMode: string): Bluebird<ITestResult> {
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const filePath = path.join(pluginPath(gameMode), "plugins.txt");
  return new Bluebird<ITestResult>((resolve, reject) => {
    access(filePath, constants.W_OK, (err) => {
      if (err && err.code === "EPERM") {
        const res: ITestResult = {
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
  store: Redux.Store<IStateWithGamebryo>,
): Bluebird<ITestResult> {
  const state = store.getState();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const { missing, actions } = missingGroupFixes(state);

  // nothing found => everything good
  if (missing.length === 0) {
    return Bluebird.resolve(undefined);
  }

  const res: ITestResult = {
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
      batchDispatch(store, actions);
      return Bluebird.resolve();
    },
  };
  return Bluebird.resolve(res);
}

function testMissingGroups(
  t: TranslationFunction,
  store: Redux.Store<IStateWithGamebryo>,
  tries: number = 10,
): Bluebird<ITestResult> {
  return Bluebird.delay(100 * (10 - tries)).then(() => {
    const state = store.getState();
    return state.userlist.__isLoaded && state.masterlist.__isLoaded
      ? testMissingGroupsImpl(t, store)
      : tries > 0
        ? testMissingGroups(t, store, tries - 1)
        : Bluebird.resolve(undefined);
  });
}

function testUserlistInvalid(
  t: TranslationFunction,
  state: IStateWithGamebryo,
): Bluebird<ITestResult> {
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const userlist: ILOOTList = state.userlist;
  const names = new Set<string>();

  if (userlist === undefined || userlist.plugins === undefined) {
    return Bluebird.resolve(undefined);
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
    const userlistPath = path.join(getVortexPath("userData"), gameMode, "userlist.yaml");
    return Bluebird.resolve({
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
      severity: "warning" as ProblemSeverity,
    });
  }

  // search for duplicate after rules
  let duplicateAfter: string | ILootReference;
  const plugin = (userlist.plugins || []).find((iter) => {
    duplicateAfter = (iter.after || []).find((val, idx) => iter.after.indexOf(val, idx + 1) !== -1);
    return duplicateAfter !== undefined;
  });
  if (plugin !== undefined) {
    const userlistPath = path.join(getVortexPath("userData"), gameMode, "userlist.yaml");
    return Bluebird.resolve({
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
              reference: typeof duplicateAfter === "string" ? duplicateAfter : duplicateAfter.name,
              userlistPath,
            },
          },
        ),
      },
      severity: "warning" as ProblemSeverity,
    });
  }
  return Bluebird.resolve(undefined);
}

function testMasterlistOutdated(
  api: IExtensionApi,
  infoCache?: PluginInfoCache,
): Bluebird<ITestResult> {
  const state = api.store.getState();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }
  return new Bluebird<ITestResult>((resolve, reject) =>
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

async function testExceededPluginLimit(
  api: IExtensionApi,
  infoCache: PluginInfoCache,
): Promise<ITestResult> {
  const { translate, store } = api;
  const state = store.getState();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }
  const loadOrder = getSafe(state, ["loadOrder"], {});
  const pluginList = state.session.plugins.pluginList ?? {};
  const plugins: Record<string, any> = {};
  for (const key of Object.keys(pluginList)) {
    if (getSafe(loadOrder, [key, "enabled"], false)) {
      let isLight;
      try {
        isLight = (await infoCache.getInfo(pluginList[key].filePath)).isLight;
      } catch (err) {
        // We won't log this as the error will most definitely
        //  be raised somewhere else -> nop
        isLight = false;
      }
      plugins[key] = { ...pluginList[key], isLight };
    }
  }

  const isValid = (id: string) => {
    const plugin = plugins[id];
    return plugin?.deployed || plugin?.isNative;
  };

  const regular = Object.keys(plugins).filter((id) => isValid(id) && !plugins[id].isLight);
  const light = Object.keys(plugins).filter((id) => isValid(id) && plugins[id].isLight);
  const medium = Object.keys(plugins).filter((id) => isValid(id) && plugins[id].isMedium);

  const eslGame = supportsESL(gameMode);
  const mediumGame = supportsMediumMasters(gameMode);
  const regLimit = mediumGame ? 253 : eslGame ? 254 : 255;
  return regular.length > regLimit || medium.length > 256 || light.length > 4096
    ? Bluebird.resolve({
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
        severity: "warning" as ProblemSeverity,
      })
    : Bluebird.resolve(undefined);
}

interface IESPInfo {
  isLight: boolean;
  isBlueprint: boolean;
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
  private mAPI: IExtensionApi;
  constructor(api: IExtensionApi) {
    this.mAPI = api;
  }

  public async getInfo(filePath: string): Promise<IESPInfo> {
    const id = this.fileId(filePath);
    let mtime: number;
    let ino: bigint;
    try {
      const stat = await fsStat(filePath, { bigint: true });
      mtime = Number(stat.mtimeMs);
      ino = stat.ino;
    } catch (err) {
      mtime = Date.now();
    }

    const activeGameMode = activeGameId(this.mAPI.getState());
    if (
      this.mCache[id] === undefined ||
      mtime !== this.mCache[id].lastModified ||
      ino !== this.mCache[id].lastINO
    ) {
      const info = await ESPFile.open(filePath, activeGameMode);
      this.mCache[id] = {
        lastModified: mtime,
        lastINO: ino,
        info: {
          isLight: info.isLight,
          isBlueprint: supportsBlueprintPlugins(activeGameMode) && info.isBlueprint,
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

function testTriggerSort(api: IExtensionApi): Bluebird<ITestResult> {
  return new Bluebird<ITestResult>((resolve, reject) => {
    api.onAsync("did-deploy", async () => {
      await new Bluebird((res) => setTimeout(res, 2000));
      api.events.emit("autosort-plugins", true, (err: Error) => resolve);
    });
  });
}

/**
 * For Starfield only. Verifies that no non-Blueprint plugin declares a Blueprint
 * plugin as a master. The game strips Blueprint masters from non-Blueprint
 * plugins in memory, which destroys references and produces unresolved FormIDs.
 */
async function testBlueprintMasters(
  api: IExtensionApi,
  infoCache: PluginInfoCache,
): Promise<ITestResult> {
  const { translate, store } = api;
  const state = store.getState();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode) || !supportsBlueprintPlugins(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const pluginList = state.session.plugins.pluginList ?? {};
  const natives = new Set<string>(nativePlugins(gameMode));
  const loadOrder: { [plugin: string]: IPluginLoadOrderEntry } = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
    (plugin: string) => loadOrder[plugin].enabled || natives.has(plugin),
  );

  interface IParsedPlugin {
    name: string;
    isBlueprint: boolean;
    masterList: string[];
  }

  const pluginDetails: IParsedPlugin[] = [];
  for (const plugin of enabledPlugins) {
    if (pluginList[plugin] === undefined) continue;
    try {
      const info = await infoCache.getInfo(pluginList[plugin].filePath);
      pluginDetails.push({
        name: plugin,
        isBlueprint: info.isBlueprint,
        masterList: info.masterList,
      });
    } catch (err) {
      log("warn", "failed to parse esp file", {
        name: pluginList[plugin].filePath,
        err: getErrorMessageOrDefault(err),
      });
      pluginDetails.push({ name: plugin, isBlueprint: false, masterList: [] });
    }
  }

  const blueprintPlugins = new Set<string>(
    pluginDetails.filter((plugin) => plugin.isBlueprint).map((plugin) => plugin.name),
  );

  if (blueprintPlugins.size === 0) {
    return Bluebird.resolve(undefined);
  }

  const broken = pluginDetails.reduce(
    (prev, plugin) => {
      if (plugin.isBlueprint) {
        return prev;
      }
      const offendingMasters = plugin.masterList.filter((master) =>
        blueprintPlugins.has(master.toLowerCase()),
      );
      if (offendingMasters.length > 0) {
        prev[plugin.name] = offendingMasters;
      }
      return prev;
    },
    {} as { [pluginName: string]: string[] },
  );

  if (Object.keys(broken).length === 0) {
    return Bluebird.resolve(undefined);
  }

  return Bluebird.resolve({
    description: {
      short: translate("Blueprint plugin used as master"),
      long:
        translate(
          "The following enabled plugins declare a Blueprint plugin as a master. " +
            "Starfield strips Blueprint masters from non-Blueprint plugins at load, " +
            "which will break references and corrupt your save. These plugins must " +
            "be disabled or rebuilt against a non-Blueprint master:",
        ) +
        "[table][tbody]" +
        Object.keys(broken)
          .map((plugin) => {
            const offending = broken[plugin].map(pluginLink).join("[br][/br]");
            const detail = pluginList[plugin];
            const name = detail !== undefined ? path.basename(detail.filePath) : plugin;
            return (
              "[tr]" +
              [pluginLink(name), translate("has Blueprint master"), offending]
                .map((iter) => `[td]${iter}[/td]`)
                .join() +
              "[/tr]" +
              "[tr][/tr]"
            );
          })
          .join("\n") +
        "[/tbody][/table]",
      context: { callbacks: showPluginCallbacks(api) },
    },
    severity: "error" as ProblemSeverity,
  });
}

function testRulesUnfulfilled(api: IExtensionApi): Bluebird<ITestResult> {
  const { translate: t, store } = api;

  const state = store.getState();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Bluebird.resolve(undefined);
  }

  const pluginInfo: { [id: string]: IPluginCombined } = state.session.plugins?.pluginInfo || {};

  const discovery = discoveryByGame(state, gameMode);

  const natives = new Set<string>(nativePlugins(gameMode));
  const loadOrder: { [plugin: string]: IPluginLoadOrderEntry } = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
    (plugin: string) =>
      pluginInfo[plugin] !== undefined && (loadOrder[plugin].enabled || natives.has(plugin)),
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

  const addCheck = (target: ICheckMap, source: string, entry: ILootReference) => {
    if (typeof entry !== "string" && entry.condition !== undefined) {
      // evaluation of condition not supported atm
      // return;
    }
    const name = depName(entry);
    const id = name.toLowerCase();
    setdefault(target, id, { display: name, refs: [] }).refs.push(source);
    // the loot api returns the regular file name as a fallback if no display name is specified
    // in the user-/masterlist - without escaping characters that may be special in markdown.
    if (!!entry["display"] && entry["display"] !== name) {
      target[id].display = markdownToBBCode(entry["display"]);
    }
  };

  // for each enabled plugin, go through their list of required and incompatble files.
  enabledPlugins.forEach((pluginId: string) => {
    (pluginInfo[pluginId]?.requirements || []).forEach((req) => addCheck(reqCheck, pluginId, req));
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
  const exists = (id: string): Bluebird<boolean> =>
    [".esp", ".esl", ".esm"].includes(path.extname(id))
      ? Bluebird.resolve(pluginsSet.has(id))
      : fs
          .statAsync(path.resolve(dataPath, id))
          .then(() => true)
          .catch((err) => false);

  return Bluebird.map(Object.keys(reqCheck), (reqId) =>
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
      Bluebird.map(Object.keys(incCheck), (incId) =>
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
        return Bluebird.resolve(undefined);
      } else {
        const reqLine = (left: string, right: string) =>
          `[tr][td]${left}[/td][td]${t("requires")}[/td][td]${right}[/td][/tr]`;
        const incLine = (left: string, right: string) =>
          `[tr][td]${left}[/td][td]${t("is incompatible with")}[/td][td]${right}[/td][/tr]`;

        return Bluebird.resolve<ITestResult>({
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
          severity: "warning" as ProblemSeverity,
          onRecheck: () => {
            return new Bluebird((resolve, reject) => {
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

// Backstop for how long onDidDeploy waits for a plugin-details refresh before giving up. This runs
// inside the awaited 'did-deploy' event, so it must never wait forever (see usage). 30s clears the
// legitimate worst case (full-load-order LOOT operations on large modlists run ~20s+; sortPlugins
// alone has been seen at 23s) and matches the health-check timeout, so it only trips on a genuine
// stall (e.g. LOOT being torn down by a concurrent game switch never invoking the callback).
const PLUGIN_DETAILS_TIMEOUT = 30000;

// Whether the collections install flow has flagged this profile as still owing a plugin sort (set
// when a collection install begins, cleared once a sort succeeds). Lives in the cross-extension
// transactions slice; read here and by the profile-did-change drain.
function hasPendingPluginSort(state: IState, profileId: string): boolean {
  return Object.keys(state.persistent.transactions.pendingPluginSort?.[profileId] ?? {}).length > 0;
}

function onDidDeploy(api: IExtensionApi, profileId: string): Bluebird<void> {
  const state: IState = api.getState();
  const profile = state.persistent.profiles[profileId];
  const currentGameId = activeGameId(state);
  const discovery = discoveryByGame(state, currentGameId);
  return discovery?.path != null &&
    profile?.gameId === currentGameId &&
    gameSupported(profile?.gameId)
    ? Bluebird.resolve(updatePluginList(api.store, profile.modState, profile.gameId))
        .then(
          () =>
            new Bluebird<void>((resolve) => {
              // This runs inside the awaited 'did-deploy' event, so it must never wait forever: if
              // it did, the deployment's finally could not clear the "deployment" mod-activity and
              // every later plugin update/sort would be deferred indefinitely.
              let settled = false;
              let timeout: ReturnType<typeof setTimeout>;
              const done = () => {
                if (settled) {
                  return;
                }
                settled = true;
                clearTimeout(timeout);
                api.events.removeListener("profile-will-change", done);
                api.events.removeListener("gamemode-activated", done);
                resolve();
              };
              // Take the cue from a profile/game switch: LOOT for this game is being torn down, so
              // the plugin-details callback may never fire. Stop waiting and let the deployment
              // finish; the incoming game's activation (and the durable sort marker) re-runs the
              // sort. The timeout is only a last-resort backstop for a stall with no switch.
              api.events.once("profile-will-change", done);
              api.events.once("gamemode-activated", done);
              timeout = setTimeout(() => {
                // no switch took the cue, so LOOT simply never answered for this game
                lootErrorReporter.report(
                  api,
                  new VortexError("LOOT did not answer with plugin details", {
                    kind: "loot:failed",
                  }),
                  LootPhase.Metadata,
                  { silent: true, context: { [SpanAttribute.LootGameMode]: profile.gameId } },
                );
                done();
              }, PLUGIN_DETAILS_TIMEOUT);
              const pluginList = getSafe(api.getState(), ["session", "plugins", "pluginList"], {});
              api.events.emit(
                "plugin-details",
                profile.gameId,
                Object.keys(pluginList ?? {}),
                done,
              );
            }),
        )
        .then(() => delay(500)) // wait a bit for the plugin details to be updated
        .then(() => {
          // A collection install that hasn't been sorted yet leaves a per-profile "sort owed"
          // marker. Such a sort must run even when the user disabled auto-sort (the collection
          // would otherwise be left unsorted/unenabled), so force it; a normal deploy with no
          // marker honours the auto-sort setting. doSort clears the marker on success. Read fresh
          // state: the marker may have changed during the (bounded) wait above.
          const force = hasPendingPluginSort(api.getState(), profileId);
          return api.events.emit("autosort-plugins", force);
        })
        .then(() => Bluebird.resolve())
    : Bluebird.resolve();
}

function sanitizeForIPC(obj: any) {
  // Omit functions and non-serializeable properties from gameData before sending over IPC
  const sanitizedGameData = Object.fromEntries(
    Object.entries(obj).filter(
      ([key, value]) => typeof value !== "function" && typeof value !== "symbol",
    ),
  );
  return JSON.parse(JSON.stringify(sanitizedGameData));
}

function init(context: IExtensionContextExt) {
  const setPluginLight = async (id: string, enable: boolean) => {
    const state: IStateWithGamebryo = context.api.getState();
    const profile = activeProfile(state);
    const plugin: IPlugin = state.session.plugins.pluginList[id];
    if (plugin === undefined) {
      return;
    }

    const esp = await ESPFile.open(plugin.filePath, profile.gameId);
    await esp.setLightFlag(enable);

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

  const history = new PluginHistory(context.api, makeSetPluginGhost(context.api), setPluginLight);

  register(context, setPluginLight);
  initPersistor(context);

  context.registerHistoryStack("plugins", history);

  context
    // first thing on once, init game support for the previously discovered games
    .once(() =>
      initGameSupport(context.api).then(() => {
        const store = context.api.store;

        loot = new LootInterface(context.api);

        deployWatcher = startDeployWatcher(context.api, (profileId) =>
          onDidDeploy(context.api, profileId),
        );

        // folded gamebryo-plugin-indexlock wiring; only attaches listeners, no ordering
        // dependency within this block
        onceIndexLock(context.api, deployWatcher.isDeploying);

        context.api.events.on(
          "will-install-dependencies",
          (gameId: string, modId: string, recommendations: boolean, onCancel: () => void) => {
            const state: IState = context.api.getState();
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

        context.api.events.on(
          "did-install-mod",
          (gameId: string, _archiveId: string, modId: string) => {
            handleModInstalled(context.api, gameId, modId);
          },
        );

        context.api.events.on(
          "collection-postprocess-complete",
          (gameId: string, collectionModId: string) => {
            if (!gameSupported(gameId)) {
              return;
            }
            const profileId = lastActiveProfileForGame(context.api.getState(), gameId);
            if (!profileId) {
              return;
            }
            // persist the loadOrder hive before the plugin list refresh: the postprocess
            // enable batch may still be inside the debounced diff pipeline
            const state = context.api.getState<IStateWithGamebryo>();
            const flushed: Promise<void> =
              pluginPersistor !== undefined
                ? pluginPersistor.syncFromState(gameId, state.loadOrder ?? {}).catch((err) => {
                    log("error", "failed to sync plugin state after collection install", {
                      error: getErrorMessageOrDefault(err),
                    });
                  })
                : Promise.resolve();
            void flushed.then(() => onDidDeploy(context.api, profileId));
          },
        );

        context.api.onStateChange(["settings", "gameMode", "discovered"], (previous, current) => {
          initGameSupport(context.api).then(() => null);
        });

        context.api.onStateChange(["session", "base", "mainPage"], (previous, current) => {
          if (previous !== current && current === "gamebryo-plugins") {
            // TODO: We could theoretically apply filters here to display the plugins that were added.
            context.api.store.dispatch(clearNewPluginCounter());
          }
        });

        // when the user toggles local_loot_rules on the active profile,
        // immediately back up the global userlist and seed the profile copy
        context.api.onStateChange(["persistent", "profiles"], (previous, current) => {
          const activeProfileId = getSafe(
            context.api.store.getState(),
            ["settings", "profiles", "activeProfileId"],
            undefined,
          );
          if (activeProfileId === undefined) {
            return;
          }
          const prevFeature = previous[activeProfileId]?.features?.local_loot_rules;
          const currFeature = current[activeProfileId]?.features?.local_loot_rules;
          if (prevFeature === currFeature) {
            return;
          }
          const profile = current[activeProfileId];
          if (profile === undefined || !gameSupported(profile.gameId)) {
            return;
          }
          const userDataPath = getVortexPath("userData");
          const activeFile = path.join(userDataPath, profile.gameId, "userlist.yaml");
          const globalBackup = path.join(userDataPath, profile.gameId, "userlist.yaml.global");
          const profDir = path.join(userDataPath, profile.gameId, "profiles", profile.id);
          const profFile = path.join(profDir, "userlist.yaml");

          const copyIgnoringMissing = async (src: string, dest: string) => {
            try {
              await fs.copyAsync(src, dest, { noSelfCopy: true });
            } catch (err) {
              if (getErrorCode(err) !== "ENOENT") {
                throw err;
              }
            }
          };

          if (currFeature && !prevFeature) {
            // toggled ON: back up global and seed profile copy
            (async () => {
              await copyIgnoringMissing(activeFile, globalBackup);
              await fs.ensureDirAsync(profDir);
              await copyIgnoringMissing(activeFile, profFile);
            })().catch((err) => {
              log(
                "warn",
                "failed to initialize per-profile userlist",
                getErrorMessageOrDefault(err),
              );
            });
          } else if (!currFeature && prevFeature) {
            // toggled OFF: save profile state, restore global backup
            (async () => {
              await fs.ensureDirAsync(profDir);
              await copyIgnoringMissing(activeFile, profFile);
              await copyIgnoringMissing(globalBackup, activeFile);
              if (userlistPersistor !== undefined) {
                await userlistPersistor.loadFiles(profile.gameId);
              }
            })().catch((err) => {
              log("warn", "failed to restore global userlist", getErrorMessageOrDefault(err));
            });
          }
        });

        context.api.events.on("set-plugin-list", (newPlugins: string[], setEnabled?: boolean) => {
          handleSetPluginList(context.api, newPlugins, setEnabled);
        });

        context.api.events.on(
          "profile-will-change",
          (nextProfileId: string, enqueue: (cb: () => PromiseLike<void>) => void) => {
            const state = context.api.store.getState();
            const oldProfileId = getSafe(
              state,
              ["settings", "profiles", "activeProfileId"],
              undefined,
            );
            const oldProfile = state.persistent.profiles[oldProfileId];
            const nextProfile =
              nextProfileId !== undefined ? profileById(state, nextProfileId) : undefined;

            if (nextProfileId === undefined) {
              context.api.store.dispatch(setPluginList(undefined));
              // still need to save per-profile userlist before deactivation
              if (oldProfile?.features?.local_loot_rules) {
                enqueue(() =>
                  stopSync()
                    .then(() =>
                      userlistPersistor !== undefined
                        ? userlistPersistor.disable()
                        : Bluebird.resolve(),
                    )
                    .then(() =>
                      masterlistPersistor !== undefined
                        ? masterlistPersistor.disable()
                        : Bluebird.resolve(),
                    )
                    .then(() => swapUserlistForProfile(oldProfile, undefined))
                    .then(() => loot.wait())
                    .catch((err) => {
                      context.api.showErrorNotification("Failed to change profile", err);
                      return Bluebird.resolve();
                    }),
                );
              }
              return;
            }
            const gameMode = activeGameId(state);
            if (nextProfile !== undefined && nextProfile.gameId !== gameMode) {
              context.api.store.dispatch(setPluginList(undefined));
            }
            enqueue(() => {
              return stopSync()
                .then(() =>
                  userlistPersistor !== undefined
                    ? userlistPersistor.disable()
                    : Bluebird.resolve(),
                )
                .then(() =>
                  masterlistPersistor !== undefined
                    ? masterlistPersistor.disable()
                    : Bluebird.resolve(),
                )
                .then(() => swapUserlistForProfile(oldProfile, nextProfile))
                .then(() => loot.wait())
                .catch((err) => {
                  context.api.showErrorNotification("Failed to change profile", err);
                  return Bluebird.resolve();
                });
            });
          },
        );

        context.api.events.on("profile-did-change", (newProfileId: string) => {
          const newProfile = getSafe(
            store.getState(),
            ["persistent", "profiles", newProfileId],
            undefined,
          );

          if (newProfile !== undefined && gameSupported(newProfile.gameId)) {
            updatePluginList(store, newProfile.modState, newProfile.gameId)
              .then(() => startSync(context.api))
              .catch((err) => {
                context.api.showErrorNotification("Failed to change profile", err);
              });

            // Durable recovery for an interrupted collection install. The collections extension
            // sets a per-profile "sort owed" marker when a collection install begins and clears it
            // only once a plugin sort actually succeeds (see autosort doSort). If a previous session
            // crashed/quit before the post-install sort landed, the marker is still set when that
            // profile next becomes active (this event also fires on startup). A startup deploy is
            // skipped when nothing changed, so request a deployment explicitly; its 'did-deploy'
            // handler refreshes the plugin list and sorts (no collection session is active here, so
            // it is not suppressed) and clears the marker. Deploy-first means we never sort against
            // an undeployed Data folder.
            if (hasPendingPluginSort(store.getState(), newProfileId)) {
              log("info", "draining pending collection plugin sort", {
                profileId: newProfileId,
                gameId: newProfile.gameId,
              });
              context.api.events.emit("deploy-mods", () => undefined);
            }
          }
        });

        context.api.events.on("did-update-masterlist", () => {
          if (masterlistPersistor !== undefined) {
            const gameId = activeGameId(context.api.store.getState());
            masterlistPersistor.loadFiles(gameId);
          }
        });

        context.api.events.on("mod-enabled", (profileId: string, modId: string) => {
          handleModEnabled(context.api, profileId, modId);
        });

        history.init();
      }),
    );

  return true;
}

export default init;
