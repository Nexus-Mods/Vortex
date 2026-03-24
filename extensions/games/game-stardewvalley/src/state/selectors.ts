/**
 * Provides typed selectors for Stardew Valley extension state paths.
 */
import type { types } from "vortex-api";

import { util } from "vortex-api";

import { GAME_ID } from "../common";

/** Returns the discovered install path for Stardew Valley, if available. */
export function selectSdvDiscoveryPath(
  state: types.IState,
): string | undefined {
  return util.getSafe(
    state,
    ["settings", "gameMode", "discovered", GAME_ID, "path"],
    undefined,
  );
}

/** Returns the discovered path for a game tool entry. */
export function selectDiscoveredToolPath(
  state: types.IState,
  gameId: string,
): string {
  return util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId, "path"],
    "",
  );
}

/** Returns the persisted mod map for Stardew Valley. */
export function selectSdvMods(state: types.IState): {
  [modId: string]: types.IMod;
} {
  return util.getSafe(state, ["persistent", "mods", GAME_ID], {});
}

/** Returns whether config merge mode is enabled for a profile. */
export function selectMergeConfigsEnabled(
  state: types.IState,
  profileId: string,
): boolean {
  return util.getSafe(
    state,
    ["settings", "SDV", "mergeConfigs", profileId],
    false,
  );
}

/** Returns mod ids tracked by the synthetic config mod attribute payload. */
export function selectConfigModAttributes(
  state: types.IState,
  configModId: string,
): string[] {
  return util.getSafe(
    state,
    ["persistent", "mods", GAME_ID, configModId, "attributes", "configMod"],
    [],
  );
}
