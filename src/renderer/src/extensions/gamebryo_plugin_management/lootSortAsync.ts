import { unknownToError } from "@vortex/shared";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { activeProfile } from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import type { ILOOTSortApiCall } from "./types/ILOOTList";
import type { IStateWithGamebryo } from "./types/IStateWithGamebryo";

// all late-bound from the entry module, where the LootInterface and the plugin-list scan live
export interface ILootSortDeps {
  masterlistExists: (gameId: string) => PromiseLike<boolean>;
  downloadMasterlist: (gameMode: string) => PromiseLike<void>;
  updatePluginList: (modState: IProfile["modState"], gameId: string) => PromiseLike<void>;
}

/**
 * The handler behind the lootSortAsync extension API: downloads the masterlist when none exists,
 * refreshes the plugin list, runs plugin-details for every known plugin, then autosorts and
 * answers the callback with the sorted load order (lowercased).
 */
export function makeLootSortAsync(
  api: IExtensionApi,
  deps: ILootSortDeps,
): (sortCall: ILOOTSortApiCall) => Promise<void> {
  return async (sortCall: ILOOTSortApiCall) => {
    const { pluginFilePaths, onSortCallback } = sortCall;
    if (!Array.isArray(pluginFilePaths) || onSortCallback === undefined) {
      log("error", "incorrect lootSortAsync call parameters");
      onSortCallback(new Error("incorrect lootSortAsync call parameters"), []);
      return;
    }
    const profile = activeProfile(api.getState());
    try {
      if (!(await deps.masterlistExists(profile.gameId))) {
        await deps.downloadMasterlist(profile.gameId);
      }
      await deps.updatePluginList(profile.modState, profile.gameId);
      await new Promise((resolve) => {
        const pluginList = api.getState<IStateWithGamebryo>().session.plugins?.pluginList ?? {};
        api.events.emit("plugin-details", profile.gameId, Object.keys(pluginList), resolve);
      });
      api.events.emit("autosort-plugins", true, (err: Error) => {
        if (err) {
          onSortCallback(err, []);
        }
        const sortedLO = api.getState<IStateWithGamebryo>().loadOrder || {};
        const sortedList = Object.keys(sortedLO)
          .sort((lhs, rhs) => sortedLO[lhs].loadOrder - sortedLO[rhs].loadOrder)
          .map((pluginName: string) => pluginName.toLowerCase());

        onSortCallback(null, sortedList);
      });
    } catch (err) {
      log("error", "failed to update plugin list", err);
      onSortCallback(unknownToError(err), []);
    }
  };
}
