import { createAction } from "redux-act";

import type { ILoadOrderEntry, LoadOrder } from "../types/types";

export interface ISetFBLoadOrderEntryPayload {
  profileId: string;
  loEntry: ILoadOrderEntry;
  loadOrderId?: string;
}

export interface ISetFBLoadOrderPayload {
  profileId: string;
  loadOrder: LoadOrder;
  loadOrderId?: string;
}

// A primary write carries no loadOrderId.
const withLoadOrderId = (loadOrderId: string | undefined) =>
  loadOrderId === undefined ? {} : { loadOrderId };

// Replace one entry; without loadOrderId, in the primary load order.
export const setFBLoadOrderEntry = createAction<ISetFBLoadOrderEntryPayload>(
  "SET_FB_LOAD_ORDER_ENTRY",
  (profileId: string, loEntry: ILoadOrderEntry, loadOrderId?: string) => ({
    profileId,
    loEntry,
    ...withLoadOrderId(loadOrderId),
  }),
);

// Without loadOrderId, sets the primary load order.
export const setFBLoadOrder = createAction<ISetFBLoadOrderPayload>(
  "SET_FB_LOAD_ORDER",
  (profileId: string, loadOrder: LoadOrder, loadOrderId?: string) => ({
    profileId,
    loadOrder,
    ...withLoadOrderId(loadOrderId),
  }),
);

// Drop every load order of a profile that no longer exists.
export const removeFBLoadOrderProfile = createAction(
  "REMOVE_FB_LOAD_ORDER_PROFILE",
  (profileId: string) => ({ profileId }),
);
