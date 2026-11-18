import { actionsToReducerSpec } from "../../../reducers/builder";
import type { ILoadOrder as ILegacyLoadOrder } from "../../mod_load_order/types/types";
import * as actions from "../actions/loadOrder";
import { isPrimaryLoadOrderId } from "../registry";
import type { ILoadOrderEntry, LoadOrder } from "../types/types";

/**
 * persistent.loadOrder, keyed by profile id. Three systems share it, each for the profiles of the
 * games it manages: this extension stores a file-based load order, the legacy mod_load_order page
 * its entries keyed by mod id, and the core setLoadOrder action whatever array a game hands it.
 */
export type PersistentLoadOrders = Record<string, LoadOrder | ILegacyLoadOrder | unknown[]>;

declare module "@/types/IState" {
  interface IPersistentState {
    loadOrder: PersistentLoadOrders;
  }
}

// whether a stored load order item is the entry with this id
function isEntry(item: unknown, id: string): boolean {
  return typeof item === "object" && item !== null && "id" in item && item.id === id;
}

// Collections and older extensions hand over the order as an object of entries.
function asLoadOrder(loadOrder: unknown): LoadOrder | undefined {
  if (Array.isArray(loadOrder)) {
    return loadOrder as LoadOrder;
  }
  if (typeof loadOrder === "object" && loadOrder != null) {
    return Object.values(loadOrder as Record<string, ILoadOrderEntry | undefined>).filter(
      (entry): entry is ILoadOrderEntry => entry !== undefined,
    );
  }
  return undefined;
}

// The primary load order of each profile, persistent.loadOrder[profileId].
export const modLoadOrderReducer = actionsToReducerSpec<PersistentLoadOrders, typeof actions>(
  {},
  actions,
  {
    setFBLoadOrderEntry: (state, { profileId, loEntry, loadOrderId }) => {
      if (!isPrimaryLoadOrderId(loadOrderId)) {
        return state;
      }
      const current = state[profileId] ?? [];
      // the profile holds another system's load order, which has no file-based entries
      if (!Array.isArray(current)) {
        return state;
      }
      const replaced = current.map((entry: unknown) =>
        isEntry(entry, loEntry.id) ? loEntry : entry,
      );
      return { ...state, [profileId]: replaced };
    },
    setFBLoadOrder: (state, { profileId, loadOrder, loadOrderId }) => {
      const next = asLoadOrder(loadOrder);
      if (!isPrimaryLoadOrderId(loadOrderId) || next === undefined) {
        return state;
      }
      return { ...state, [profileId]: next };
    },
    removeFBLoadOrderProfile: (state, { profileId }) => {
      const { [profileId]: _removed, ...remaining } = state;
      return remaining;
    },
  },
);
