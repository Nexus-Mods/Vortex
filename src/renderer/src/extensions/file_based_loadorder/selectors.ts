import * as _ from "lodash";
import { createSelector } from "reselect";

import type { IState } from "../../types/IState";
import type { IModLookupInfo } from "../mod_management/util/testModReference";
import { activeGameId } from "../profile_management/selectors";
import { profileById } from "../profile_management/selectors";
import type { NamedLoadOrders } from "./reducers/multiLoadOrder";
// the slice type's module also declares session.fblo on IState
import type { IHeldLoadOrder } from "./reducers/session";
import { isPrimaryLoadOrderId } from "./registry";
import { DEFAULT_LOAD_ORDER_ID, type IValidationResult, type LoadOrder } from "./types/types";

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

// Every miss returns this one instance, so consumers comparing by reference see no change.
const noLoadOrder: LoadOrder = Object.freeze([]) as unknown as LoadOrder;

// A plain lookup; a page reads two ids in turn, which a single-slot memo would thrash on.
export function loadOrderForProfile(
  state: IState,
  profileId: string,
  loadOrderId?: string,
): LoadOrder {
  const persistent = state?.persistent as {
    loadOrder?: Record<string, unknown>;
    loadOrders?: NamedLoadOrders;
  };
  const loadOrder = isPrimaryLoadOrderId(loadOrderId)
    ? persistent?.loadOrder?.[profileId]
    : persistent?.loadOrders?.[profileId]?.[loadOrderId];
  return Array.isArray(loadOrder) ? (loadOrder as LoadOrder) : noLoadOrder;
}

// A named load order as stored; undefined when the profile has never had one.
export function storedNamedLoadOrder(
  state: IState,
  profileId: string,
  loadOrderId: string,
): LoadOrder | undefined {
  const persistent = state?.persistent as { loadOrders?: NamedLoadOrders };
  return persistent?.loadOrders?.[profileId]?.[loadOrderId];
}

// The load order whose tab a profile has open; undefined before the first pick.
export function activeLoadOrderIdForProfile(state: IState, profileId: string): string | undefined {
  return state?.session?.fblo?.activeLoadOrder?.[profileId];
}

// The result of the last validation of a load order; undefined when it passed.
export function validationResultForLoadOrder(
  state: IState,
  profileId: string,
  loadOrderId: string = DEFAULT_LOAD_ORDER_ID,
): IValidationResult | undefined {
  return state?.session?.fblo?.validationResult?.[profileId]?.[loadOrderId];
}

// Changes when the page is told to read its load orders again.
export function refreshIdForProfile(state: IState, profileId: string): string {
  return state?.session?.fblo?.refresh?.[profileId] ?? "";
}

// A load order held while its mods change; undefined when none is held.
export function loadOrderHeldForDeploy(
  state: IState,
  profileId: string,
  loadOrderId: string,
): IHeldLoadOrder | undefined {
  return state?.session?.fblo?.heldForDeploy?.[profileId]?.[loadOrderId];
}

export const currentGameMods = createSelector(
  allMods,
  activeGameId,
  (inMods, gameId) => inMods[gameId] ?? {},
);

export const currentModStateForProfile = createSelector(profileById, (profile) =>
  profile ? profile.modState : {},
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
        (modStateIn?.[modId]?.enabled ?? false) &&
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
    return modStateIn?.[modId]?.enabled ?? false;
  },
);
