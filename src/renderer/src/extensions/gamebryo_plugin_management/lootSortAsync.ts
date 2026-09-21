import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { VortexError } from "@vortex/shared/errors";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { activeProfile } from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import type { ILOOTSortApiCall } from "./types/ILOOTList";
import { LootPhase, lootErrorReporter } from "./util/LootErrorReporter";
import { SpanAttribute } from "./util/spanAttributes";

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
      if (sorted.length === 0 && pluginFilePaths.length > 0) {
        // the caller asked for plugins and got none back, which it reports as its own error
        lootErrorReporter.report(
          api,
          new VortexError("LOOT sorted none of the plugins it was given", { kind: "loot:failed" }),
          LootPhase.Sort,
          { silent: true, context: { [SpanAttribute.LootSortRequested]: pluginFilePaths.length } },
        );
      }
      onSortCallback(null, sorted);
    } catch (err) {
      log("warn", "lootSortAsync failed", {
        gameId: profile.gameId,
        error: getErrorMessageOrDefault(err),
      });
      if (err instanceof VortexError) {
        // the caller is told through its own callback, so only telemetry is owed here
        lootErrorReporter.report(api, err, LootPhase.Sort, { silent: true });
      }
      onSortCallback(unknownToError(err), []);
    } finally {
      clearTimeout(deadline);
    }
  };
}
