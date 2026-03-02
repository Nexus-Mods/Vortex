import * as _ from "lodash";

import * as path from "path";

import { setValidationResult } from "./actions/session";

import type { IExtensionContext } from "../../types/IExtensionContext";
import {
  type ILoadOrderGameInfo,
  type ILoadOrderGameInfoExt,
  type IValidationResult,
  type LoadOrder,
  LoadOrderValidationError,
  type ILoadOrderEntryExt,
} from "./types/types";

import type { ICollection } from "./types/collections";

import { generate, Interface, parser } from "./collections/loadOrder";

import FileBasedLoadOrderPage from "./views/FileBasedLoadOrderPage";

import { modLoadOrderReducer } from "./reducers/loadOrder";
import { sessionReducer } from "./reducers/session";

import type * as types from "../../types/api";
import * as util from "../../util/api";
import * as selectors from "../../util/selectors";

import { log } from "../../util/log";
import { setFBLoadOrder } from "./actions/loadOrder";

import { addGameEntry, findGameEntry } from "./gameSupport";
import {
  assertValidationResult,
  errorHandler,
  toExtendedLoadOrderEntry,
} from "./util";

import * as fs from "../../util/fs";

import { currentGameMods, currentLoadOrderForProfile } from "./selectors";

import UpdateSet from "./UpdateSet";
import { unknownToError } from "@vortex/shared";

interface IDeployment {
  [modType: string]: types.IDeployedFile[];
}

interface IProfileState {
  [id: string]: types.IProfile;
}

async function genToolsRunning(
  api: types.IExtensionApi,
  prev: any,
  current: any,
) {
  if (Object.keys(current).length === 0) {
    // User has finished using a tool/game ensure we refresh our load order
    //  just in case he changed the LO inside that tool/game.
    const state = api.store.getState();
    const profile = selectors.activeProfile(state);
    if (profile?.gameId === undefined) {
      // Profiles changed with no active profile.
      //  Maybe it was changed by an extension ?
      return;
    }

    const gameEntry = findGameEntry(profile.gameId);
    if (gameEntry === undefined || gameEntry.condition?.() === false) {
      // This game wasn't registered with the LO component or doesn't want to use it.
      return;
    }

    try {
      const currentLO: LoadOrder = await gameEntry.deserializeLoadOrder();
      api.store.dispatch(setFBLoadOrder(profile.id, currentLO));
    } catch (err) {
      // nop - any errors would've been reported by applyNewLoadOrder.
    }
  }

  return;
}

async function genLoadOrderChange(
  api: types.IExtensionApi,
  oldState: any,
  newState: any,
) {
  const state = api.store.getState();
  const profile = selectors.activeProfile(state);
  if (profile?.gameId === undefined) {
    // Profiles changed with no active profile.
    //  Maybe it was changed by an extension ?
    return;
  }

  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined || gameEntry.condition?.() === false) {
    // This game wasn't registered with the LO component or doesn't want to use it.
    return;
  }

  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Don't do anything if we're in the middle of installing deps
    log("info", "skipping load order serialization/deserialization");
    return;
  }

  if (newState[profile.id] === undefined) {
    // Profile removed.
    return;
  }

  const prevLO: LoadOrder = Array.isArray(oldState[profile.id])
    ? oldState[profile.id]
    : [];
  const loadOrder: LoadOrder = Array.isArray(newState[profile.id])
    ? newState[profile.id]
    : [];
  const prevIds = prevLO.map((lo) => lo.id);
  const newIds = loadOrder.map((lo) => lo.id);

  const added = newIds.filter((id) => !prevIds.includes(id));
  const removed = prevIds.filter((id) => !newIds.includes(id));
  const same = loadOrder.reduce((acc, lo, idx) => {
    if (!prevIds.includes(lo.id) || prevIds.indexOf(lo.id) !== idx) {
      return acc;
    }
    const currFileId = util.getSafe(
      state,
      ["persistent", "mods", profile.gameId, lo?.modId, "attributes", "fileId"],
      undefined,
    );
    const prevFileId =
      updateSet
        .findEntry(lo)
        ?.entries?.filter((e) => e.id === lo.id && e.name === lo.name)?.[0]
        ?.fileId ?? -1;
    if (!!currFileId && currFileId !== prevFileId) {
      updateSet.shouldRestore = true;
      return acc;
    }

    if (lo.enabled !== prevLO[idx].enabled) {
      return acc;
    }

    acc.push(lo.id);
    return acc;
  }, []);

  if (
    !updateSet.shouldRestore &&
    (added.length > 0 || removed.length > 0 || same.length !== newIds.length)
  ) {
    try {
      // This is the only place where we want applyNewLoadOrder to be called
      //  as we've detected a change in the load order.
      await applyNewLoadOrder(api, profile, prevLO, loadOrder);
    } catch (err) {
      // nop - any errors would've been reported by applyNewLoadOrder.
    }
  } else {
    try {
      await validateLoadOrder(api, profile, loadOrder);
    } catch (err) {
      return errorHandler(api, gameEntry.gameId, unknownToError(err));
    }
  }
}

async function genProfilesChange(
  api: types.IExtensionApi,
  oldState: IProfileState,
  newState: IProfileState,
) {
  const state = api.store.getState();
  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Don't do anything if we're in the middle of installing deps
    //log('info', 'skipping load order serialization/deserialization');
    return;
  }
  const profile = selectors.activeProfile(state);
  if (profile?.gameId === undefined) {
    // Profiles changed with no active profile.
    //  Maybe it was changed by an extension ?
    return;
  }

  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined || gameEntry.condition?.() === false) {
    // This game wasn't registered with the LO component or doesn't want to use it.
    return;
  }

  if (newState[profile.id] === undefined) {
    // Profile removed.
    return;
  }

  updateSet.forceReset();

  try {
    const loadOrder: LoadOrder = await gameEntry.deserializeLoadOrder();
    updateSet.init(
      profile.gameId,
      loadOrder.map(toExtendedLoadOrderEntry(api)),
    );
    api.store.dispatch(setFBLoadOrder(profile.id, loadOrder));
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

type DeploymentEvent = "did-deploy" | "will-purge" | "did-purge";
async function genDeploymentEvent(
  api: types.IExtensionApi,
  profileId: string,
  eventType: DeploymentEvent,
) {
  // Yes - this gets executed on purge too (at least for now).
  const state = api.store.getState();
  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Don't do anything if we're in the middle of installing deps
    //log('info', 'skipping load order serialization/deserialization');
    return Promise.resolve();
  }
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId === undefined) {
    // I guess it's theoretically possible for the deployment
    //  event to be queued and by the time we execute this piece of
    //  logic, the user may have removed the profile.
    log("warn", "invalid profile id", profileId);
    return;
  }

  const gameEntry: ILoadOrderGameInfo = findGameEntry(profile.gameId);
  if (gameEntry === undefined || gameEntry.condition?.() === false) {
    // Game does not require LO.
    return;
  }

  if (eventType === "will-purge") {
    // This is a purge event - we need to serialize the load order
    //  to the update set.
    let currentStoredLO: LoadOrder = currentLoadOrderForProfile(
      state,
      profileId,
    );
    if (!Array.isArray(currentStoredLO)) {
      currentStoredLO = [];
    }
    updateSet.init(
      profile.gameId,
      currentStoredLO.map(toExtendedLoadOrderEntry(api)),
    );
    updateSet.shouldRestore = true;
    return;
  }

  try {
    let deserializedLO: LoadOrder =
      (await gameEntry.deserializeLoadOrder()) ?? [];
    if (eventType === "did-deploy") {
      // This is a deploy event - we need to restore the load order
      deserializedLO = updateSet.restore(deserializedLO);
    }
    api.store.dispatch(setFBLoadOrder(profile.id, deserializedLO));
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

async function applyNewLoadOrder(
  api: types.IExtensionApi,
  profile: types.IProfile,
  prev: LoadOrder,
  newLO: LoadOrder,
): Promise<void> {
  // This function is intended to execute as a reaction to a change
  //  in LO - never call the setNewLoadOrder state action in here unless
  //  you have a fetish for infinite loops.
  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined || profile === undefined) {
    // How ?
    if (gameEntry === undefined) {
      log(
        "warn",
        "unable to apply new load order",
        `${profile.gameId} is not registered with LoadOrder component`,
      );
    } else {
      log(
        "warn",
        "unable to apply new load order",
        `profile ${profile.id} does not exist`,
      );
    }
    return;
  }

  try {
    await gameEntry.serializeLoadOrder(newLO, prev);
    await validateLoadOrder(api, profile, newLO);
  } catch (err) {
    return errorHandler(api, gameEntry.gameId, unknownToError(err));
  }

  return;
}

function genDidDeploy(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    genDeploymentEvent(api, profileId, "did-deploy");
}

function genWillPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    genDeploymentEvent(api, profileId, "will-purge");
}

function genDidPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    genDeploymentEvent(api, profileId, "did-purge");
}

let updateSet: UpdateSet;
export default function init(context: IExtensionContext) {
  context.registerReducer(["persistent", "loadOrder"], modLoadOrderReducer);
  context.registerReducer(["session", "fblo"], sessionReducer);

  const setOrder = async (
    profileId: string,
    loadOrder: types.LoadOrder,
    refresh?: boolean,
  ) => {
    const profile = selectors.profileById(context.api.getState(), profileId);
    if (!profile) {
      context.api.showErrorNotification(
        "Failed to set load order",
        new Error("Please re-activate the game before trying again."),
        { allowReport: false },
      );
      return;
    }
    context.api.store.dispatch(setFBLoadOrder(profileId, loadOrder));
  };
  context.registerMainPage("sort-none", "Load order", FileBasedLoadOrderPage, {
    priority: 120,
    id: "file-based-loadorder",
    hotkey: "E",
    group: "per-game",
    visible: () => {
      const currentGameId: string = selectors.activeGameId(
        context.api.store.getState(),
      );
      const gameEntry: ILoadOrderGameInfo = findGameEntry(currentGameId);
      return gameEntry?.condition !== undefined
        ? gameEntry.condition()
        : gameEntry !== undefined;
    },
    props: () => {
      return {
        getGameEntry: findGameEntry,
        onSortByDeployOrder: async (profileId: string) => {
          const state = context.api.getState();
          const profile = selectors.profileById(state, profileId);
          const loadOrder = currentLoadOrderForProfile(state, profileId);
          const mods: { [modId: string]: types.IMod } = currentGameMods(state);
          const filtered: types.IMod[] = Object.values(mods).filter(
            (m: types.IMod) =>
              loadOrder.find((lo) => lo.modId === m.id) !== undefined,
          );
          const sorted = await util.sortMods(
            profile.gameId,
            filtered,
            context.api,
          );
          const findIndex = (entry: types.ILoadOrderEntry) => {
            return sorted.findIndex((m) => m.id === entry.modId);
          };
          const loadOrderSorted = [...loadOrder];
          loadOrderSorted.sort((a, b) => findIndex(a) - findIndex(b));
          context.api.store.dispatch(
            setFBLoadOrder(profileId, loadOrderSorted),
          );
        },
        onImportList: async () => {
          const api = context.api;
          const file = await api.selectFile({
            filters: [{ name: "JSON", extensions: ["json"] }],
            title: "Import Load Order",
          });
          if (!file) {
            return;
          }
          try {
            const fileData = await fs.readFileAsync(file, { encoding: "utf8" });
            const loData: LoadOrder = JSON.parse(fileData);
            if (!Array.isArray(loData)) {
              throw new Error("invalid load order data");
            }
            const profileId = selectors.activeProfile(api.getState()).id;
            context.api.store.dispatch(setFBLoadOrder(profileId, loData));
            api.sendNotification({
              type: "success",
              message: "Load order imported",
              id: "import-load-order",
            });
          } catch (err) {
            api.showErrorNotification("Failed to import load order", err, {
              allowReport: false,
            });
          }
        },
        onExportList: async () => {
          const api = context.api;
          const state = api.getState();
          const profileId = selectors.activeProfile(state).id;
          const loadOrder = currentLoadOrderForProfile(state, profileId);
          const data = JSON.stringify(loadOrder, null, 2);
          const loPath = await api.saveFile({
            defaultPath: "loadorder.json",
            filters: [{ name: "JSON", extensions: ["json"] }],
            title: "Export Load Order",
          });
          if (loPath) {
            try {
              await fs.ensureDirWritableAsync(path.basename(loPath));
              await fs.writeFileAsync(loPath, data);
              api.sendNotification({
                type: "success",
                message: "Load order exported",
                id: "export-load-order",
              });
            } catch (err) {
              api.showErrorNotification("Failed to export load order", err, {
                allowReport: false,
              });
            }
          }
        },
        validateLoadOrder: (profile: types.IProfile, loadOrder: LoadOrder) =>
          validateLoadOrder(context.api, profile, loadOrder),
        onSetOrder: setOrder,
        onStartUp: (gameId: string) => onStartUp(context.api, gameId),
        onShowError: (gameId: string, error: Error) =>
          errorHandler(context.api, gameId, error),
      };
    },
  });

  context.registerLoadOrder = ((
    gameInfo: ILoadOrderGameInfo,
    extPath: string,
  ) => {
    addGameEntry(gameInfo, extPath);
  }) as any;

  context.optional.registerCollectionFeature(
    "file_based_load_order_collection_data",
    (gameId: string, includedMods: string[]) => {
      const state = context.api.getState();
      const stagingPath = selectors.installPathForGame(state, gameId);
      const mods: { [modId: string]: types.IMod } = currentGameMods(state);
      return generate(
        context.api,
        state,
        gameId,
        stagingPath,
        includedMods,
        mods,
      );
    },
    (gameId: string, collection: ICollection) =>
      parser(context.api, gameId, collection, updateSet),
    () => Promise.resolve(),
    (t) => t("Load Order"),
    (state: types.IState, gameId: string) => {
      const gameEntry: ILoadOrderGameInfoExt = findGameEntry(gameId);
      if (gameEntry === undefined || gameEntry.condition?.() === false) {
        return false;
      }
      return !(gameEntry.noCollectionGeneration ?? false);
    },
    Interface,
  );

  context.registerActionCheck("SET_FB_LOAD_ORDER", (state, action: any) => {
    const { profileId, loadOrder } = action.payload;
    if (!loadOrder || !Array.isArray(loadOrder)) {
      log("error", "invalid load order", loadOrder);
    }
    const profile = selectors.profileById(state, profileId);
    const gameId = profile?.gameId ?? selectors.activeGameId(state);
    if (updateSet && gameId) {
      updateSet.init(
        gameId,
        (loadOrder ?? []).map(toExtendedLoadOrderEntry(context.api)),
      );
    }
    return undefined;
  });

  context.once(() => {
    updateSet = new UpdateSet(context.api, (gameId: string) => {
      const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
      return gameEntry !== undefined;
    });
    context.api.onStateChange(
      ["session", "base", "toolsRunning"],
      (prev, current) => genToolsRunning(context.api, prev, current),
    );

    context.api.onStateChange(["persistent", "loadOrder"], (prev, current) =>
      genLoadOrderChange(context.api, prev, current),
    );

    context.api.onStateChange(["persistent", "profiles"], (prev, current) =>
      genProfilesChange(context.api, prev, current),
    );

    //context.api.events.on('gamemode-activated', (gameId: string) => onGameModeActivated(context.api, gameId));

    context.api.onAsync("did-deploy", genDidDeploy(context.api));
    context.api.onAsync("will-purge", genWillPurge(context.api));
    context.api.onAsync("did-purge", genDidPurge(context.api));

    context.api.onAsync(
      "will-remove-mods",
      (gameId: string, modIds: string[], removeOpts: types.IRemoveModOptions) =>
        onWillRemoveMods(context.api, gameId, modIds, removeOpts),
    );

    context.api.onAsync(
      "will-remove-mod",
      (gameId: string, modId, removeOpts: types.IRemoveModOptions) =>
        onWillRemoveMods(context.api, gameId, [modId], removeOpts),
    );
  });

  return true;
}

async function onGameModeActivated(api: types.IExtensionApi, gameId: string) {
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if (gameEntry === undefined || gameEntry.condition?.() === false) {
    // Game does not require LO or doesn't want to use it.
    return;
  }
  updateSet.forceReset();
  updateSet.init(gameId);
}

async function onWillRemoveMods(
  api: types.IExtensionApi,
  gameId: string,
  modIds: string[],
  removeOpts: types.IRemoveModOptions,
): Promise<void> {
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if (gameEntry === undefined || gameEntry.condition?.() === false) {
    // Game does not require LO or doesn't want to use it.
    return;
  }
  if (removeOpts?.willBeReplaced === true) {
    updateSet.shouldRestore = true;
    const state = api.getState();
    const profileId = selectors.lastActiveProfileForGame(state, gameId);
    const loadOrder = currentLoadOrderForProfile(state, profileId);
    const filtered = loadOrder.reduce((acc, lo, idx) => {
      if (!modIds.includes(lo.modId ?? lo.id)) {
        return acc;
      }
      const loEntryExt: ILoadOrderEntryExt = toExtendedLoadOrderEntry(api)(
        lo,
        idx,
      );
      acc.push(loEntryExt);
      return acc;
    }, []);
    if (!updateSet.isInitialized()) {
      updateSet.init(gameId, filtered);
    } else {
      filtered.forEach(updateSet.addEntry);
    }
  }
  return Promise.resolve();
}

async function validateLoadOrder(
  api: types.IExtensionApi,
  profile: types.IProfile,
  loadOrder: LoadOrder,
): Promise<IValidationResult> {
  const state = api.getState();
  try {
    if (profile?.id === undefined) {
      log(
        "error",
        "failed to validate load order due to undefined profile",
        loadOrder,
      );
      throw new util.DataInvalid("invalid profile");
    }
    const prevLO = currentLoadOrderForProfile(state, profile.id);
    const gameEntry: ILoadOrderGameInfo = findGameEntry(profile.gameId);
    if (gameEntry === undefined) {
      const details =
        gameEntry === undefined
          ? { gameId: profile.gameId }
          : { profileId: profile.id };
      log("error", "invalid game entry", details);
      throw new util.DataInvalid("invalid game entry");
    }
    const validRes: IValidationResult = await gameEntry.validate(
      prevLO,
      loadOrder,
    );
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }

    api.store.dispatch(setValidationResult(profile.id, undefined));
    return Promise.resolve(undefined);
  } catch (err) {
    return Promise.reject(err);
  }
}

async function onStartUp(
  api: types.IExtensionApi,
  gameId: string,
): Promise<LoadOrder> {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if (gameEntry === undefined || profileId === undefined) {
    const details = gameEntry === undefined ? { gameId } : { profileId };
    log("debug", "invalid game entry or invalid profile", details);
    return Promise.resolve(undefined);
  }

  const prev = currentLoadOrderForProfile(state, profileId);
  try {
    const loadOrder = await gameEntry.deserializeLoadOrder();
    const validRes: IValidationResult = await gameEntry.validate(
      prev,
      loadOrder,
    );
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }
    return Promise.resolve(loadOrder);
  } catch (err) {
    return errorHandler(api, gameId, unknownToError(err)).then(() =>
      err instanceof LoadOrderValidationError
        ? Promise.reject(err)
        : Promise.resolve(undefined),
    );
  }
}
