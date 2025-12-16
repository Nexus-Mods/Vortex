import { IModLookupInfo } from "../mod_management/util/testModReference";
import { IState } from "../../types/IState";
import { activeGameId } from "../profile_management/selectors";
import { getSafe } from "../../util/storeHelper";

import * as _ from "lodash";
import { createSelector } from "reselect";

import { profileById } from "../profile_management/selectors";

const allMods = (state: IState) => state.persistent.mods;
const allLoadOrders = (state: IState) => state?.persistent?.["loadOrder"] || {};

export const currentLoadOrderForProfile = createSelector(
  [allLoadOrders, (_, profileId: string) => profileId],
  (loadOrders, profileId: string) => {
    if (!loadOrders || !profileId) {
      return [];
    }
    return Array.isArray(loadOrders[profileId]) ? loadOrders[profileId] : [];
  },
);

export const currentGameMods = createSelector(
  allMods,
  activeGameId,
  (inMods, gameId) => inMods[gameId] ?? {},
);

export const currentModStateForProfile = createSelector(
  profileById,
  (profile) => (profile ? profile.modState : {}),
);

let lastLookupInfo: IModLookupInfo[];
export const enabledMods = createSelector(
  currentGameMods,
  currentModStateForProfile,
  (mods, modStateIn) => {
    const res: IModLookupInfo[] = [];
    Object.keys(mods || {}).forEach((modId) => {
      const attributes = mods[modId].attributes || {};
      if (
        getSafe(modStateIn, [modId, "enabled"], false) &&
        (attributes["fileMD5"] ||
          attributes["fileName"] ||
          attributes["logicalFileName"] ||
          attributes["name"])
      ) {
        res.push({
          ...attributes,
          id: modId,
          type: mods[modId].type,
          installationPath: mods[modId].installationPath,
        } as any);
      }
    });

    // avoid changing the object if content didn't change. reselect avoids recalculating unless input
    // changes but it's very possible mods/modState changes without causing the enabled-keys to change
    if (!_.isEqual(res, lastLookupInfo)) {
      lastLookupInfo = res;
    }

    return lastLookupInfo;
  },
);

export const isModEnabled = createSelector(
  [currentGameMods, currentModStateForProfile, (_, modId: string) => modId],
  (mods, modStateIn, modId) => {
    if (!mods || !modId) {
      return false;
    }
    const mod = mods[modId];
    if (!mod) {
      return false;
    }
    return getSafe(modStateIn, [modId, "enabled"], false);
  },
);
