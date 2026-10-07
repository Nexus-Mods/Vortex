import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/loadOrder";
import { isPrimaryLoadOrderId } from "../registry";
import type { LoadOrder } from "../types/types";

// keyed by profile id, then by load order id
export type NamedLoadOrders = Record<string, Record<string, LoadOrder>>;

// The named load orders of each profile, persistent.loadOrders[profileId][loadOrderId]; the
// primary stays in persistent.loadOrder.
export const multiLoadOrderReducer = actionsToReducerSpec<NamedLoadOrders, typeof actions>(
  {},
  actions,
  {
    setFBLoadOrderEntry: (state, { profileId, loEntry, loadOrderId }) => {
      const current = state[profileId]?.[loadOrderId];
      if (isPrimaryLoadOrderId(loadOrderId) || current === undefined) {
        return state;
      }
      const replaced = current.map((entry) => (entry.id === loEntry.id ? loEntry : entry));
      return { ...state, [profileId]: { ...state[profileId], [loadOrderId]: replaced } };
    },
    setFBLoadOrder: (state, { profileId, loadOrder, loadOrderId }) => {
      // payloads arrive from extensions and collections untyped, so the array check is real
      if (isPrimaryLoadOrderId(loadOrderId) || !Array.isArray(loadOrder)) {
        return state;
      }
      return { ...state, [profileId]: { ...state[profileId], [loadOrderId]: loadOrder } };
    },
    removeFBLoadOrderProfile: (state, { profileId }) => {
      const { [profileId]: _removed, ...remaining } = state;
      return remaining;
    },
  },
  {
    _: {
      type: "object",
      description: () => "Corrupted load orders will be reset",
      deleteBroken: true,
      elements: {
        _: {
          type: "array",
          description: () => "Corrupted load order will be reset",
          deleteBroken: true,
        },
      },
    },
  },
);
