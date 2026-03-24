/**
 * Selectors for discovering and resolving active SMAPI tool/mod entries.
 */
import type { types } from "vortex-api";

import { gte } from "semver";
import { selectors, util } from "vortex-api";

import { GAME_ID, MOD_TYPE_SMAPI, SMAPI_MOD_ID } from "../common";
import { selectSdvMods } from "../state/selectors";

/**
 * Resolves the discovered SMAPI tool entry for Stardew Valley.
 *
 * @param api Vortex extension API (`types.IExtensionApi`) used to read
 * discovery state.
 * @returns Discovered tool (`types.IDiscoveredTool`) when present and has a
 * path; otherwise `undefined`.
 */
export function findSMAPITool(
  api: types.IExtensionApi,
): types.IDiscoveredTool | undefined {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const tool = discovery?.tools?.["smapi"];
  return tool?.path ? tool : undefined;
}

/**
 * Lists currently enabled installed mods that correspond to the SMAPI package.
 *
 * @param api Vortex extension API (`types.IExtensionApi`) used to read profile
 * and mod state.
 * @returns Active SMAPI mods (`types.IMod[]`) for the last active Stardew
 * profile.
 */
export function getSMAPIMods(api: types.IExtensionApi): types.IMod[] {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  const isActive = (modId: string) =>
    util.getSafe(profile, ["modState", modId, "enabled"], false);
  const isSMAPI = (mod: types.IMod) =>
    mod.type === MOD_TYPE_SMAPI && mod.attributes?.modId === SMAPI_MOD_ID;
  const mods: { [modId: string]: types.IMod } = selectSdvMods(state);
  return Object.values(mods).filter(
    (mod: types.IMod) => isSMAPI(mod) && isActive(mod.id),
  );
}

/**
 * Selects the newest enabled SMAPI mod entry by semantic version.
 *
 * @param api Vortex extension API (`types.IExtensionApi`) used to resolve
 * active SMAPI mods.
 * @returns Highest-version SMAPI mod (`types.IMod`) when any are enabled;
 * otherwise `undefined`.
 */
export function findSMAPIMod(api: types.IExtensionApi): types.IMod | undefined {
  const smapiMods = getSMAPIMods(api);
  return smapiMods.length === 0
    ? undefined
    : smapiMods.length > 1
      ? smapiMods.reduce<types.IMod | undefined>((prev, iter) => {
          if (prev === undefined) {
            return iter;
          }
          return gte(
            iter?.attributes?.version ?? "0.0.0",
            prev?.attributes?.version ?? "0.0.0",
          )
            ? iter
            : prev;
        }, undefined)
      : smapiMods[0];
}
