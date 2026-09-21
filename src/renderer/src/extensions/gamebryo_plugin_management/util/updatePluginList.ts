import * as path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { dismissNotification } from "../../../actions/notifications";
import { log } from "../../../logging";
import type { ThunkStore } from "../../../types/IExtensionContext";
import { withActivityTracking } from "../../../util/activity";
import { setErrorContext } from "../../../util/errorHandling";
import * as fs from "../../../util/fs";
import { showError } from "../../../util/message";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";
import { setDeploymentNecessary } from "../../mod_management/actions/deployment";
import { installPathForGame } from "../../mod_management/selectors";
import { getCurrentActivator } from "../../mod_management/util/deploymentMethods";
import { setPluginList } from "../actions/plugins";
import { ESPFile } from "../esp/ESPFile";
import type { IPlugins } from "../types/IPlugins";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";
import { isNativePlugin, pluginFormat, supportsBlueprintPlugins } from "./gameSupport";
import { selectPluginFiles } from "./isPlugin";
import type PluginPersistor from "./PluginPersistor";
import { SpanAttribute } from "./spanAttributes";
import toPluginId from "./toPluginId";

// keyed by mod id
type IModStates = Record<string, { enabled: boolean }>;

// late-bound: the entry module creates the persistor on init
type PersistorGetter = () => Pick<PluginPersistor, "setKnownPlugins"> | undefined;

async function updatePluginListImpl(
  store: ThunkStore<IStateWithGamebryo>,
  newModList: IModStates,
  gameId: string,
  getPersistor: PersistorGetter,
): Promise<void> {
  const state = store.getState();

  const modIdByFileName: Record<string, string> = {};
  const pluginStates: IPlugins = {};

  const addPlugin = (basePath: string, fileName: string, modId: string, deployed: boolean) => {
    const pluginId = toPluginId(fileName);
    pluginStates[pluginId] = {
      modId,
      filePath: path.join(basePath, fileName),
      isNative: isNativePlugin(gameId, fileName),
      warnings: state.session.plugins?.pluginList?.[pluginId]?.warnings ?? {},
      deployed,
    };
  };

  const discovery = discoveryByGame(state, gameId);
  if (discovery === undefined || discovery.path === undefined) {
    // paranoia, this shouldn't happen
    return;
  }

  const gameMods = state.persistent.mods[gameId] ?? {};
  const game = getGame(gameId);
  if (game === undefined) {
    // we may get here if the active game is no longer supported due to
    // the extension being disabled.
    return;
  }

  const dataModType: unknown = game.details?.dataModType;
  const modType = typeof dataModType === "string" ? dataModType : "";
  const modPath = game.getModPaths(discovery.path)[modType];
  // an unreadable game folder is for the game mode management to report
  const deployedScan = fs
    .readdirAsync(modPath)
    .catch(() => [])
    .then((fileNames) => selectPluginFiles(modPath, fileNames, gameId));

  const enabledModIds = Object.keys(gameMods).filter(
    (modId) => newModList[modId]?.enabled ?? false,
  );
  const activator = getCurrentActivator(state, gameId, true);
  const installBasePath = installPathForGame(state, gameId);
  const readErrors: string[] = [];

  // staged plugins first, so a deployed copy can be attributed to the mod it came from
  await Promise.all(
    enabledModIds.map(async (modId) => {
      const mod = gameMods[modId];
      if (mod === undefined || mod.installationPath === undefined) {
        log("error", "mod not found", { gameId, modId });
        return;
      }
      const overridden = new Set((mod.fileOverrides ?? []).map((name) => path.basename(name)));
      const modInstPath = path.join(installBasePath, mod.installationPath);
      try {
        const fileNames = await fs.readdirAsync(modInstPath);
        const candidates = fileNames
          .map((fileName) => activator?.getDeployedPath(fileName) ?? fileName)
          .filter((fileName) => !overridden.has(fileName));
        for (const fileName of await selectPluginFiles(modInstPath, candidates, gameId)) {
          modIdByFileName[fileName] = mod.id;
          addPlugin(modInstPath, fileName, mod.id, false);
        }
      } catch (err) {
        readErrors.push(mod.id);
        log("warn", "failed to read mod directory", {
          path: mod.installationPath,
          error: getErrorMessageOrDefault(err),
        });
      }
    }),
  );

  if (readErrors.length > 0) {
    showError(
      store.dispatch,
      "Failed to read some mods",
      "The following mods could not be searched (see log for details):\n" +
        readErrors.map((error) => `"${error}"`).join("\n"),
      { allowReport: false, id: "failed-to-read-mods" },
    );
  } else {
    store.dispatch(dismissNotification("failed-to-read-mods"));
  }

  for (const fileName of await deployedScan) {
    addPlugin(modPath, fileName, modIdByFileName[fileName] ?? "", true);
  }

  store.dispatch(setPluginList(pluginStates));
  const pluginIds = Object.keys(pluginStates);
  if (pluginIds.length === 0) {
    return;
  }
  if (pluginIds.some((pluginId) => !pluginStates[pluginId].deployed)) {
    store.dispatch(setDeploymentNecessary(gameId, true));
  }

  const persistor = getPersistor();
  if (persistor === undefined) {
    return;
  }
  const fileNameByPluginId: Record<string, string> = {};
  for (const pluginId of pluginIds) {
    fileNameByPluginId[pluginId] = path.basename(pluginStates[pluginId].filePath);
  }
  let blueprintIds: Set<string> | undefined;
  if (supportsBlueprintPlugins(gameId)) {
    blueprintIds = new Set<string>();
    for (const pluginId of pluginIds) {
      try {
        const esp = await ESPFile.open(pluginStates[pluginId].filePath, gameId);
        if (esp.isBlueprint) {
          blueprintIds.add(pluginId);
        }
      } catch {
        // parse failures are already reported elsewhere; skip
      }
    }
  }
  persistor.setKnownPlugins(fileNameByPluginId, blueprintIds);
  // rides on every error span for the rest of the session.
  setErrorContext(SpanAttribute.PluginCount, String(pluginIds.length));
  setErrorContext(SpanAttribute.PluginFormat, pluginFormat(gameId));
}

/** Rescan a game's plugins into session.plugins.pluginList and hand them to the persistor. */
export function makeUpdatePluginList(getPersistor: PersistorGetter) {
  return (
    store: ThunkStore<IStateWithGamebryo>,
    newModList: IModStates,
    gameId: string,
  ): Promise<void> =>
    withActivityTracking(
      store.dispatch,
      "plugins",
      "update-plugin-list",
      updatePluginListImpl(store, newModList, gameId, getPersistor).catch((err) => {
        showError(store.dispatch, "Failed to update plugin list", err);
      }),
    );
}
