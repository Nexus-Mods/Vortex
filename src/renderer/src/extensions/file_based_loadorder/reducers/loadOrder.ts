import type { IReducerSpec } from "../../../types/IExtensionContext";
import * as actions from "../actions/loadOrder";
import { isPrimaryLoadOrderId } from "../registry";
import type { ILoadOrderEntry, LoadOrder } from "../types/types";

// keyed by profile id
type PrimaryLoadOrders = Record<string, LoadOrder>;

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
export const modLoadOrderReducer: IReducerSpec<PrimaryLoadOrders> = {
  reducers: {
    [actions.setFBLoadOrderEntry.getType()]: (
      state,
      { profileId, loEntry, loadOrderId }: actions.ISetFBLoadOrderEntryPayload,
    ) => {
      if (!isPrimaryLoadOrderId(loadOrderId)) {
        return state;
      }
      const replaced = (state[profileId] ?? []).map((entry) =>
        entry.id === loEntry.id ? loEntry : entry,
      );
      return { ...state, [profileId]: replaced };
    },
    [actions.setFBLoadOrder.getType()]: (
      state,
      { profileId, loadOrder, loadOrderId }: actions.ISetFBLoadOrderPayload,
    ) => {
      const next = asLoadOrder(loadOrder);
      if (!isPrimaryLoadOrderId(loadOrderId) || next === undefined) {
        return state;
      }
      return { ...state, [profileId]: next };
    },
    [actions.removeFBLoadOrderProfile.getType()]: (state, { profileId }: { profileId: string }) => {
      const { [profileId]: _removed, ...remaining } = state;
      return remaining;
    },
  },
  defaults: {},
};
