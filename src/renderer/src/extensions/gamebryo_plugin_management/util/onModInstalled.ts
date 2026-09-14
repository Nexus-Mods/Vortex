import * as path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getCollectionActiveSession } from "../../../util/collectionInstallSessionSelectors";
import * as fs from "../../../util/fs";
import { installPathForGame } from "../../mod_management/selectors";
import { getCurrentActivator } from "../../mod_management/util/deploymentMethods";
import { setPluginList } from "../actions/plugins";
import type { IPlugins } from "../types/IPlugins";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";
import { gameSupported, isNativePlugin } from "./gameSupport";
import { selectPluginFiles } from "./isPlugin";
import toPluginId from "./toPluginId";

/**
 * When a mod is installed during a collection install, scan its staging folder for plugin files
 * and merge them into the real plugin list. This ensures FOMOD prerequisite checks in subsequent
 * installs can see plugins from earlier-phase mods that haven't been deployed yet.
 */
export async function handleModInstalled(
  api: IExtensionApi,
  gameId: string,
  modId: string,
): Promise<void> {
  if (!gameSupported(gameId)) {
    return;
  }

  try {
    const state = api.getState<IStateWithGamebryo>();

    // Only during collection dependency installation
    if (getCollectionActiveSession(state) === undefined) {
      return;
    }

    const mod = state.persistent.mods[gameId]?.[modId];
    if (mod?.installationPath === undefined) {
      return;
    }

    const installBasePath = installPathForGame(state, gameId);
    if (installBasePath === undefined) {
      return;
    }

    const modInstPath = path.join(installBasePath, mod.installationPath);

    const fileNames: string[] = await fs.readdirAsync(modInstPath);
    if (fileNames.length === 0) {
      return;
    }
    const activator = getCurrentActivator(state, gameId, true);
    const deployedNames = fileNames.map(
      (fileName) => activator?.getDeployedPath(fileName) ?? fileName,
    );
    const pluginFileNames = await selectPluginFiles(modInstPath, deployedNames, gameId);
    if (pluginFileNames.length === 0) {
      return;
    }

    // Read fresh state and merge new entries into existing plugin list
    const currentState = api.getState<IStateWithGamebryo>();
    const existingPlugins: IPlugins = currentState.session.plugins?.pluginList ?? {};
    const merged = { ...existingPlugins };

    let added = false;
    for (const fileName of pluginFileNames) {
      const pluginId = toPluginId(fileName);
      if (merged[pluginId] === undefined) {
        merged[pluginId] = {
          modId: mod.id,
          filePath: path.join(modInstPath, fileName),
          isNative: isNativePlugin(gameId, fileName),
          warnings: {},
          deployed: false,
        };
        added = true;
      }
    }

    // a re-dispatch of identical content would still replace the slice reference and re-render
    // every pluginList consumer, so only dispatch when the merge introduced an entry
    if (added) {
      api.store?.dispatch(setPluginList(merged));
    }
  } catch (err) {
    log("warn", "failed to update plugin list for collection install", {
      modId,
      error: getErrorMessageOrDefault(err),
    });
  }
}
