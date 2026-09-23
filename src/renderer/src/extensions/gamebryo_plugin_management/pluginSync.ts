import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import * as path from "node:path";
import * as nodeUtil from "node:util";

import { getErrorCode } from "@vortex/shared";

import { log } from "../../logging";
import type { IExtensionApi, ThunkStore } from "../../types/IExtensionContext";
import Debouncer from "../../util/Debouncer";
import { clearErrorContext } from "../../util/errorHandling";
import { currentGameDiscovery } from "../gamemode_management/selectors";
import { getGame } from "../gamemode_management/util/getGame";
import { activeGameId, activeProfile } from "../profile_management/selectors";
import { setPluginOrder } from "./actions/loadOrder";
import type { IStateWithGamebryo } from "./types/IStateWithGamebryo";
import { gameSupported } from "./util/gameSupport";
import { isPluginName } from "./util/isPlugin";
import { AMBIENT_ATTRIBUTES } from "./util/spanAttributes";
import toPluginId from "./util/toPluginId";
import type { makeUpdatePluginList } from "./util/updatePluginList";

// a plugin file appearing or vanishing is debounced this long before the list is rescanned
const REFRESH_DELAY_MS = 500;

// the file lifecycle every persistor bound to a game's files shares; PromiseLike because the
// userlist persistor still answers in Bluebird
interface IFilePersistor {
  loadFiles: (gameId: string) => PromiseLike<void>;
  disable: () => PromiseLike<void>;
}

export interface IPluginSyncDeps {
  persistors: {
    plugins: IFilePersistor;
    userlist: IFilePersistor;
    masterlist: IFilePersistor;
  };
  isDeploying: () => boolean;
  updatePluginList: ReturnType<typeof makeUpdatePluginList>;
  // how long the Data folder has to stay quiet before the plugins are rescanned
  refreshDelayMs?: number;
}

export interface IPluginSync {
  /** Clears the load order, loads the persistors for the active game and watches its Data folder. */
  start: () => Promise<void>;
  /** Stops watching, drops the ambient error context and disables the plugin persistor. */
  stop: () => Promise<void>;
  /** Rescans the active profile's plugins and waits for their details. */
  refresh: () => Promise<void>;
}

/**
 * Keeps the plugin list and the plugin files in step with the active game: the persistors read
 * and write the game's plugin files, and a watch on the Data folder rescans the list when a
 * plugin file appears or vanishes outside a deployment.
 */
export function makePluginSync(api: IExtensionApi, deps: IPluginSyncDeps): IPluginSync {
  const store = api.store as ThunkStore<IStateWithGamebryo>;
  const { plugins, userlist, masterlist } = deps.persistors;
  let watcher: FSWatcher | undefined;

  const refresh = async (): Promise<void> => {
    const gameId = activeGameId(api.getState());
    if (!gameSupported(gameId)) {
      return;
    }

    const profile = activeProfile(api.getState());
    if (profile === undefined) {
      log("warn", "no profile active");
      return;
    }

    await deps.updatePluginList(store, profile.modState, profile.gameId);
    const pluginList = store.getState().session.plugins?.pluginList ?? {};
    await new Promise<void>((resolve) => {
      api.events.emit("plugin-details", profile.gameId, Object.keys(pluginList), resolve);
    });
  };

  // rescans once the Data folder has settled
  const refreshDebouncer = new Debouncer(refresh, deps.refreshDelayMs ?? REFRESH_DELAY_MS);

  const stop = (): Promise<void> => {
    if (watcher !== undefined) {
      watcher.close();
      watcher = undefined;
    }
    refreshDebouncer.clear();
    for (const key of AMBIENT_ATTRIBUTES) {
      clearErrorContext(key);
    }
    return Promise.resolve(plugins.disable());
  };

  // the persistor's own file-time stamping fires the watcher too, so only a plugin the list does
  // not know about yet, or one it still lists, counts as a change
  const onDataFolderChange = (gameId: string, modPath: string, fileName: string): void => {
    if (deps.isDeploying()) {
      // during deployment we expect plugins to be added constantly so don't autosort now,
      // it has to be triggered upon finishing deployment
      return;
    }

    if (!isPluginName(fileName, gameId)) {
      // ignore non-plugins
      return;
    }

    void stat(path.join(modPath, fileName))
      .then(
        () => true,
        () => false,
      )
      .then((exists) => {
        const pluginId = toPluginId(fileName);
        const state = store.getState();
        const known =
          state.loadOrder[pluginId] !== undefined &&
          state.session.plugins?.pluginList?.[pluginId] !== undefined;
        if (exists !== known) {
          refreshDebouncer.schedule();
        }
      });
  };

  const start = async (): Promise<void> => {
    // start with a clean slate
    store.dispatch(setPluginOrder([], false));

    const gameId = activeGameId(store.getState());
    await plugins.loadFiles(gameId);
    await userlist.loadFiles(gameId);
    await masterlist.loadFiles(gameId);

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
      watcher = watch(modPath, {}, (evt: string, fileName: string | null) => {
        // only react to file creation or delete
        if (evt === "rename" && fileName !== null) {
          onDataFolderChange(gameId, modPath, fileName);
        }
      });
      watcher.on("error", (error) => {
        log("warn", "failed to watch mod directory", { modPath, error });
      });
    } catch (err) {
      api.showErrorNotification("Failed to watch mod directory", err, {
        allowReport: getErrorCode(err) !== "ENOENT",
      });
    }
  };

  return { start, stop, refresh };
}
