import { existsSync } from "node:fs";
import path from "path";

import { actions, fs, log, selectors, types, util } from "@nexusmods/vortex-api";
/* eslint-disable */
import Bluebird from "bluebird";
import winapi from "winapi-bindings";

import { genCollectionsData, parseCollectionsData } from "./collections/collections";
import { IW3CollectionsData } from "./collections/types";
import {
  DO_NOT_DEPLOY,
  GAME_ID,
  getLoadOrderFilePath,
  LOCKED_PREFIX,
  SCRIPT_MERGER_ID,
} from "./common";
import { detectEdition, invalidateEditionCache } from "./edition";
import {
  onDidDeploy,
  onDidPurge,
  onDidRemoveMod,
  onGameModeActivation,
  onModsDisabled,
  onProfileWillChange,
  onWillDeploy,
} from "./eventHandlers";
import { healthChecks, registerHealthCheckNotifications } from "./healthChecks";
import { registerActions } from "./iconbarActions";
import IniStructure from "./iniParser";
import {
  installContent,
  installMenuMod,
  installTL,
  installDLCMod,
  installMixed,
  scriptMergerDummyInstaller,
  scriptMergerTest,
  testMenuModRoot,
  testSupportedContent,
  testSupportedTL,
  testSupportedMixed,
  testDLCMod,
} from "./installers";
import TW3LoadOrder, { applyAlphabeticalSort } from "./loadOrder";
import { canMergeXML, doMergeXML } from "./mergers";
import { getPersistentLoadOrder, migrate148 } from "./migrations";
import { testDLC, testTL } from "./modTypes";
import { W3Reducer } from "./reducers";
import {
  downloadScriptMerger,
  getScriptMergerDir,
  repairStaleScriptMerger,
  setMergerConfig,
} from "./scriptmerger";
import {
  getDLCPath,
  getAllMods,
  determineExecutable,
  getDocumentsPath,
  getTLPath,
  isTW3,
  notifyMissingScriptMerger,
} from "./util";
import CollectionsDataView from "./views/CollectionsDataView";
import Settings from "./views/Settings";

const GOG_ID = "1207664663";
const GOG_ID_GOTY = "1495134320";
const GOG_WH_ID = "1207664643";
const GOG_WH_GOTY = "1640424747";
const STEAM_ID = "499450";
const STEAM_ID_WH = "292030";
const EPIC_ID = "725a22e15ed74735bb0d6a19f3cc82d0";

const tools: types.ITool[] = [
  {
    id: SCRIPT_MERGER_ID,
    name: "W3 Script Merger",
    logo: "WitcherScriptMerger.jpg",
    executable: () => "WitcherScriptMerger.exe",
    requiredFiles: ["WitcherScriptMerger.exe"],
  },
  {
    id: GAME_ID + "_DX11",
    // Vortex shows every declared tool whether its files resolve or not, so the
    // remaster (which has no DirectX 11 binary) gets a permanently unconfigured
    // tile. Naming it plainly is better than removing the only way 4.x and
    // Classic users have of forcing DirectX 11.
    name: "The Witcher 3 (DX11 - Classic/Next-Gen only)",
    logo: "auto",
    relative: true,
    executable: () => "bin/x64/witcher3.exe",
    requiredFiles: ["bin/x64/witcher3.exe"],
  },
  {
    id: GAME_ID + "_DX12",
    name: "The Witcher 3 (DX12)",
    logo: "auto",
    relative: true,
    executable: () => "bin/x64_DX12/witcher3.exe",
    requiredFiles: ["bin/x64_DX12/witcher3.exe"],
  },
];

// The first is what the game actually writes; the misspelling was here for
// years, so it's kept as a fallback in case anything ever populated it.
const REGISTRY_KEYS = [
  "Software\\CD Projekt RED\\The Witcher 3",
  "Software\\CD Project Red\\The Witcher 3",
];

function findGame(): Bluebird<string> {
  for (const key of REGISTRY_KEYS) {
    try {
      const instPath = winapi.RegGetValue("HKEY_LOCAL_MACHINE", key, "InstallFolder");
      if (instPath && typeof instPath.value === "string") return Bluebird.resolve(instPath.value);
    } catch {
      continue;
    }
  }

  return util.GameStoreHelper.findByAppId([
    GOG_ID_GOTY,
    GOG_ID,
    GOG_WH_ID,
    GOG_WH_GOTY,
    STEAM_ID,
    STEAM_ID_WH,
    EPIC_ID,
  ]).then((game) => game.gamePath);
}

/**
 * An install that updated to the remaster in place still has the DirectX 11
 * binary recorded as its executable. That path is gone in 5.0, so the Play
 * button fails with ENOENT until the stored value is re-resolved.
 */
function repairStaleExecutable(api: types.IExtensionApi, discovery: types.IDiscoveryResult) {
  const stored = selectors.gameById(api.getState(), GAME_ID);
  const current = discovery.executable ?? stored?.executable;
  if (current === undefined || existsSync(path.join(discovery.path, current))) {
    return;
  }

  const resolved = determineExecutable(discovery.path);
  if (resolved !== current) {
    log("info", "witcher3 stored executable is missing, re-resolving", {
      from: current,
      to: resolved,
    });
    api.store.dispatch(actions.setGameParameters(GAME_ID, { executable: resolved }));
  }
}

function prepareForModding(api: types.IExtensionApi) {
  return (discovery: types.IDiscoveryResult) => {
    const findScriptMerger = async (error) => {
      log("error", "failed to download/install script merger", error);
      const scriptMergerPath = await getScriptMergerDir(api);
      if (scriptMergerPath === undefined) {
        notifyMissingScriptMerger(api);
        return Promise.resolve();
      } else {
        if (discovery?.tools?.W3ScriptMerger === undefined) {
          return setMergerConfig(discovery.path, scriptMergerPath);
        }
      }
    };
    const ensurePath = (dirpath) =>
      fs
        .ensureDirWritableAsync(dirpath)
        .catch((err) => (err.code === "EEXIST" ? Promise.resolve() : Promise.reject(err)));

    // Re-probe once per activation so the merge filter, the script merger gate
    // and the health checks all agree for the rest of this session.
    invalidateEditionCache(discovery.path);
    log("info", "witcher3 edition detected", {
      edition: detectEdition(discovery.path),
      path: discovery.path,
    });
    repairStaleExecutable(api, discovery);

    return (
      Promise.all([
        ensurePath(path.join(discovery.path, "Mods")),
        ensurePath(path.join(discovery.path, "DLC")),
        ensurePath(path.dirname(getLoadOrderFilePath())),
      ])
        // Runs before the download, which resolves the install directory from
        // the tool this may re-point.
        .then(() => repairStaleScriptMerger(api, discovery))
        .then(() =>
          downloadScriptMerger(api).catch((err) =>
            err instanceof util.UserCanceled ? Promise.resolve() : findScriptMerger(err),
          ),
        )
    );
  };
}

// let modLimitPatcher: ModLimitPatcher;

function main(context: types.IExtensionContext) {
  context.registerReducer(["settings", "witcher3"], W3Reducer);
  context.registerGame({
    id: GAME_ID,
    name: "The Witcher 3",
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => "Mods",
    logo: "gameart.jpg",
    executable: determineExecutable,
    setup: prepareForModding(context.api) as any,
    supportedTools: tools,
    requiresCleanup: true,
    // Must exist in every edition. Vortex re-checks these on startup and drops
    // the discovery when one is missing, so the DirectX 11 binary can't be used
    // here: the remaster ships without it and would un-discover the game for
    // anyone who updates in place.
    requiredFiles: ["content/content0/scripts/game/r4Game.ws"],
    environment: {
      SteamAPPId: "292030",
    },
    details: {
      steamAppId: 292030,
      ignoreConflicts: DO_NOT_DEPLOY,
      ignoreDeploy: DO_NOT_DEPLOY,
    },
  });

  context.registerInstaller(
    "scriptmergerdummy",
    15,
    scriptMergerTest as any,
    (() => scriptMergerDummyInstaller(context.api)) as any,
  );
  context.registerInstaller(
    "witcher3menumodroot",
    20,
    testMenuModRoot as any,
    installMenuMod as any,
  );
  context.registerInstaller("witcher3mixed", 25, testSupportedMixed as any, installMixed as any);
  context.registerInstaller("witcher3tl", 30, testSupportedTL as any, installTL as any);
  context.registerInstaller(
    "witcher3content",
    50,
    testSupportedContent as any,
    installContent as any,
  );
  context.registerInstaller("witcher3dlcmod", 60, testDLCMod as any, installDLCMod as any);

  context.registerModType(
    "witcher3menumodroot",
    20,
    isTW3(context.api),
    getTLPath(context.api),
    testMenuModRoot as any,
  );
  context.registerModType(
    "witcher3tl",
    25,
    isTW3(context.api),
    getTLPath(context.api),
    testTL as any,
  );
  context.registerModType(
    "witcher3dlc",
    25,
    isTW3(context.api),
    getDLCPath(context.api),
    testDLC as any,
  );
  context.registerModType(
    "w3modlimitpatcher",
    25,
    isTW3(context.api),
    getTLPath(context.api),
    () => Bluebird.resolve(false),
    { deploymentEssential: false, name: "Mod Limit Patcher Mod Type" },
  );
  context.registerModType(
    "witcher3menumoddocuments",
    60,
    isTW3(context.api),
    getDocumentsPath,
    () => Bluebird.resolve(false),
  );

  context.registerMerge(
    canMergeXML(context.api),
    doMergeXML(context.api) as any,
    "witcher3menumodroot",
  );
  // context.registerMerge(canMergeSettings(context.api), doMergeSettings(context.api) as any, 'witcher3menumoddocuments');

  context.registerMigration((oldVersion) => migrate148(context, oldVersion) as any);

  registerActions({ context });

  context.optional.registerCollectionFeature(
    "witcher3_collection_data",
    (gameId: string, includedMods: string[], collection: types.IMod) =>
      genCollectionsData(context, gameId, includedMods, collection),
    (gameId: string, collection: IW3CollectionsData) =>
      parseCollectionsData(context, gameId, collection),
    () => Promise.resolve(),
    (t) => t("Witcher 3 Data"),
    (state: types.IState, gameId: string) => gameId === GAME_ID,
    CollectionsDataView,
  );

  context.registerProfileFeature(
    "local_merges",
    "boolean",
    "settings",
    "Profile Data",
    "This profile will store and restore profile specific data (merged scripts, loadorder, etc) when switching profiles",
    () => {
      const activeGameId = selectors.activeGameId(context.api.getState());
      return activeGameId === GAME_ID;
    },
  );

  const toggleModsState = async (enabled) => {
    const state = context.api.store.getState();
    const profile = selectors.activeProfile(state);
    const loadOrder = getPersistentLoadOrder(context.api);
    const modMap = await getAllMods(context.api);
    const manualLocked = modMap.manual.filter((modName) => modName.startsWith(LOCKED_PREFIX));
    const totalLocked = [].concat(modMap.merged, manualLocked);
    const newLO = loadOrder.reduce((accum, key, idx) => {
      if (totalLocked.includes(key)) {
        accum.push(loadOrder[idx]);
      } else {
        accum.push({
          ...loadOrder[idx],
          enabled,
        });
      }
      return accum;
    }, []);
    context.api.store.dispatch(actions.setLoadOrder(profile.id, newLO as any));
  };
  const props = {
    onToggleModsState: toggleModsState,
    api: context.api,
  };
  context.registerLoadOrder(new TW3LoadOrder(props));
  context.registerSettings("Mods", Settings, undefined, isTW3(context.api), 150);

  // Registered unconditionally; each check short-circuits on editions it
  // doesn't apply to, since registrations can't vary per discovery.
  for (const check of healthChecks) {
    context.registerHealthCheck(check);
  }
  // context.registerTest('tw3-mod-limit-breach', 'gamemode-activated',
  //   () => Bluebird.resolve(testModLimitBreach(context.api, modLimitPatcher)));
  // context.registerTest('tw3-mod-limit-breach', 'mod-activated',
  //   () => Bluebird.resolve(testModLimitBreach(context.api, modLimitPatcher)));

  context.once(() => {
    IniStructure.getInstance(context.api);
    // modLimitPatcher = new ModLimitPatcher(context.api);

    context.api.events.on("gamemode-activated", onGameModeActivation(context.api));
    context.api.events.on("profile-will-change", onProfileWillChange(context.api));
    context.api.events.on("mods-enabled", onModsDisabled(context.api));

    context.api.onAsync("will-deploy", onWillDeploy(context.api) as any);
    context.api.onAsync("did-deploy", onDidDeploy(context.api) as any);
    context.api.onAsync("did-purge", onDidPurge(context.api) as any);
    context.api.onAsync("did-remove-mod", onDidRemoveMod(context.api) as any);

    context.api.onStateChange(
      ["settings", GAME_ID, "autoSortLoadOrder"],
      (previous: boolean, current: boolean) => {
        if (current && !previous) {
          void applyAlphabeticalSort(context.api);
        }
      },
    );

    registerHealthCheckNotifications(context.api);
  });
  return true;
}

module.exports = {
  default: main,
};
