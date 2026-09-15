import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { VortexError } from "@vortex/shared/errors";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { activeProfile } from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import type { ILOOTSortApiCall } from "./types/ILOOTList";

// all late-bound from the entry module, where the LootInterface and the plugin-list scan live
export interface ILootSortDeps {
  masterlistExists: (gameId: string) => PromiseLike<boolean>;
  downloadMasterlist: (gameMode: string) => PromiseLike<void>;
  updatePluginList: (modState: IProfile["modState"], gameId: string) => PromiseLike<void>;
  sortFiles: (pluginFilePaths: string[]) => PromiseLike<string[]>;
}

// a masterlist download on a slow connection is the longest legitimate step of the call
export const LOOT_SORT_API_DEADLINE_MS = 120_000;

async function sortPlugins(
  deps: ILootSortDeps,
  profile: IProfile,
  pluginFilePaths: string[],
): Promise<string[]> {
  if (!(await deps.masterlistExists(profile.gameId))) {
    await deps.downloadMasterlist(profile.gameId);
  }
  await deps.updatePluginList(profile.modState, profile.gameId);
  return deps.sortFiles(pluginFilePaths);
}

/**
 * The handler behind the lootSortAsync extension API: downloads the masterlist when none exists,
 * refreshes the plugin list, then sorts exactly the given files (the sort loads them into libloot
 * itself). The callback is answered exactly once, within the deadline, with the file names in the
 * order libloot sorted them into.
 */
export function makeLootSortAsync(
  api: IExtensionApi,
  deps: ILootSortDeps,
): (sortCall: ILOOTSortApiCall) => Promise<void> {
  return async (sortCall: ILOOTSortApiCall) => {
    const { pluginFilePaths, onSortCallback } = sortCall;
    if (typeof onSortCallback !== "function") {
      log("error", "lootSortAsync called without a callback");
      return;
    }
    if (!Array.isArray(pluginFilePaths)) {
      onSortCallback(
        new VortexError("incorrect lootSortAsync call parameters", {
          kind: "argument-invalid",
          argument: "pluginFilePaths",
        }),
        [],
      );
      return;
    }

    const profile = activeProfile(api.getState());
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => {
        reject(new VortexError("LOOT did not answer in time", { kind: "loot:failed" }));
      }, LOOT_SORT_API_DEADLINE_MS);
    });
    try {
      const sorted = await Promise.race([sortPlugins(deps, profile, pluginFilePaths), timedOut]);
      onSortCallback(null, sorted);
    } catch (err) {
      log("warn", "lootSortAsync failed", {
        gameId: profile.gameId,
        error: getErrorMessageOrDefault(err),
      });
      onSortCallback(unknownToError(err), []);
    } finally {
      clearTimeout(deadline);
    }
  };
}
