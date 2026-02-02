import LockIndex from "./LockIndex";
import { indexReducer } from "./reducers";
import { IPlugin } from "./types";

import Promise from "bluebird";
import * as React from "react";
import { selectors, types, util } from "vortex-api";

function genAttribute(
  api: types.IExtensionApi,
): types.ITableAttribute<IPlugin> {
  return {
    id: "lockIndex",
    name: "Lock Mod Index",
    icon: "locked",
    help: api.translate(
      "Use this to directly control the mod index of a plugin.\n" +
        "This will completely override the order generated automatically and is " +
        "only intended as a temporary measure or during mod development.\n\n" +
        "Please note that if the index you choose is not possible because it's too low " +
        "or too high, the plugin is prepended/appended to the list and will not have the expected " +
        "mod index.\n\n" +
        "Further note: This lets you place non-master esps before masters but the game " +
        "will not load them in this order.",
    ),
    customRenderer: (plugin: IPlugin) => (
      <LockIndex
        plugin={plugin}
        gameMode={selectors.activeGameId(api.store.getState())}
      />
    ),
    calc: (plugin: IPlugin) => {
      const state: types.IState = api.store.getState();
      const gameMode = selectors.activeGameId(state);
      const statePath = [
        "persistent",
        "plugins",
        "lockedIndices",
        gameMode,
        plugin.name,
      ];
      return util.getSafe(state, statePath, undefined);
    },
    placement: "detail",
    isVolatile: true,
    edit: {},
  };
}

interface ILoadOrderEntry {
  name: string;
  enabled: boolean;
  loadOrder: number;
}

function genApplyIndexlock(api: types.IExtensionApi) {
  let updating: boolean = false;
  return (newLoadOrder: { [key: string]: ILoadOrderEntry }) => {
    if (updating) {
      return;
    }

    const state: types.IState = api.store.getState();
    const gameMode = selectors.activeGameId(state);
    const fixed = util.getSafe(
      state,
      ["persistent", "plugins", "lockedIndices", gameMode],
      {},
    );
    if (Object.keys(fixed).length === 0) {
      // hopefully the default case: nothing locked
      return;
    }

    const pluginInfo: { [id: string]: any } = util.getSafe(
      state,
      ["session", "plugins", "pluginInfo"],
      {},
    );

    // create sorted order without any locked plugins
    const sorted = Object.keys(newLoadOrder)
      .filter((key) => fixed[key] === undefined)
      .sort(
        (lhs, rhs) => newLoadOrder[lhs].loadOrder - newLoadOrder[rhs].loadOrder,
      );

    // locked index -> locked plugin
    const toInsert: { [idx: number]: string } = Object.keys(fixed).reduce(
      (prev, key) => {
        if (newLoadOrder[key] !== undefined) {
          prev[fixed[key]] = key;
        }
        return prev;
      },
      {},
    );

    let currentIndex: number = 0;

    // insert the plugins where the locked index is too low at the beginning
    // TODO: This is rather inefficient but it should also not run too often
    // TODO: This code does nothing. It was originally written to insert those
    //   fixed plugins where the fixed idx was so low it would have had to be inserted before
    //   native plugins. How is this prevented now?
    const prependOffset = 0;
    while (true) {
      const lowIdx = Object.keys(toInsert)
        .map((idx) => parseInt(idx, 10))
        .sort()
        .find((idx) => idx <= currentIndex);
      if (lowIdx === undefined) {
        break;
      }
      sorted.splice(prependOffset, 0, toInsert[lowIdx]);
      delete toInsert[lowIdx];
      ++currentIndex;
    }

    const isNative = (id: string) =>
      util.getSafe(
        state.session,
        ["plugins", "pluginList", id, "isNative"],
        false,
      );

    const isEnabled = (id: string, entry: ILoadOrderEntry) =>
      entry.enabled || isNative(id);

    // this inserts all fixed-index plugins in the middle of the list
    // tslint:disable-next-line:prefer-for-of
    for (
      let idx = 0;
      idx < sorted.length && Object.keys(toInsert).length > 0;
      ++idx
    ) {
      if (
        newLoadOrder[sorted[idx]] === undefined ||
        !isEnabled(sorted[idx], newLoadOrder[sorted[idx]]) ||
        util.getSafe(pluginInfo, [sorted[idx], "isLight"], false)
      ) {
        continue;
      }

      ++currentIndex;
      if (toInsert[currentIndex] !== undefined) {
        sorted.splice(idx + 1, 0, toInsert[currentIndex]);
        delete toInsert[currentIndex];
      }
    }
    // finally, append everything that has an index higher than the last regularly sorted one
    Object.keys(toInsert).forEach((idx) => {
      sorted.push(toInsert[idx]);
    });
    try {
      updating = true;
      api.events.emit(
        "set-plugin-list",
        sorted.map((id) =>
          newLoadOrder[id] !== undefined ? newLoadOrder[id].name || id : id,
        ),
        false,
      );
    } finally {
      updating = false;
    }
  };
}

function init(context: types.IExtensionContext) {
  context.requireExtension("gamebryo-plugin-management");
  context.registerReducer(
    ["persistent", "plugins", "lockedIndices"],
    indexReducer,
  );

  context.registerTableAttribute("gamebryo-plugins", genAttribute(context.api));

  context.once(() => {
    const { store } = context.api;
    const liDebouncer = new util.Debouncer(() => {
      applyIndexlock(util.getSafe(store.getState(), ["loadOrder"], {}));
      return Promise.resolve();
    }, 2000);
    const applyIndexlock = genApplyIndexlock(context.api);

    let deploying = false;

    context.api.onAsync("will-deploy", () => {
      deploying = true;
      return Promise.resolve();
    });
    context.api.onAsync("did-deploy", () => {
      deploying = false;
      return Promise.resolve();
    });

    context.api.onStateChange(["loadOrder"], (oldState, newState) => {
      if (!deploying) {
        return applyIndexlock(newState);
      }
    });
    context.api.onStateChange(["session", "plugins", "pluginInfo"], () => {
      const state = store.getState();
      applyIndexlock(state.loadOrder);
    });
    context.api.onStateChange(
      ["persistent", "plugins", "lockedIndices"],
      () => {
        liDebouncer.schedule();
      },
    );
  });
  return true;
}

export default init;
