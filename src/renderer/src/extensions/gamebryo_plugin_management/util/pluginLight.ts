import { getErrorCode, unknownToError } from "@vortex/shared";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { activeProfile } from "../../profile_management/selectors";
import { ESPFile } from "../esp/ESPFile";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";

// the game, xEdit or an antivirus scanner has the deployed plugin open
const HELD_CODES = new Set(["EBUSY", "EPERM"]);

/**
 * Flips the light flag in a deployed plugin's header and records the change in the plugin
 * history; onChanged tells the plugin list to re-read that plugin.
 */
export function makeSetPluginLight(api: IExtensionApi, onChanged: (id: string) => void) {
  return async (id: string, enable: boolean): Promise<void> => {
    const state: IStateWithGamebryo = api.getState();
    const profile = activeProfile(state);
    const plugin = state.session.plugins.pluginList[id];
    if (plugin === undefined) {
      return;
    }

    try {
      const esp = await ESPFile.open(plugin.filePath, profile.gameId);
      await esp.setLightFlag(enable);
    } catch (err) {
      if (HELD_CODES.has(getErrorCode(err) ?? "")) {
        // the user can free the file themselves, so there is nothing for us to receive a report on
        api.showErrorNotification(
          "Plugin file is in use",
          `Another program has "${plugin.filePath}" open, so its light flag cannot be changed ` +
            "right now. Close the game or the tool using it and try again.",
          { allowReport: false },
        );
      } else {
        api.showErrorNotification("Failed to change the plugin's light flag", unknownToError(err));
      }
      return;
    }

    api.ext.addToHistory("plugins", {
      type: "plugin-eslified",
      gameId: profile.gameId,
      data: { id, enable },
    });
    onChanged(id);
  };
}
