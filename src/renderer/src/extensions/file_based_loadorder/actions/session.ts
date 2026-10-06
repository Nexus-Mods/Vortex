import { createAction } from "redux-act";

import type { LoadOrder, IValidationResult } from "../types/types";

export interface IHoldFBLoadOrderPayload {
  profileId: string;
  loadOrderId: string;
  loadOrder: LoadOrder;
  // the Vortex mod ids being replaced; the hold lasts until the game lists them again
  awaitedVortexModIds: string[];
}

export type IReleaseFBLoadOrderHoldPayload = Pick<
  IHoldFBLoadOrderPayload,
  "profileId" | "loadOrderId"
>;

export interface IFBLoadOrderTabSelectedPayload {
  profileId: string;
  loadOrderId: string;
}

export interface ISetValidationResultPayload {
  profileId: string;
  result: IValidationResult | undefined;
  // the primary load order when omitted
  loadOrderId?: string;
}

// This is a hack to force the load order to update.
//  It's absolutely mandatory to ensure this is
//  dispatched sparingly, as it will cause a full re-rendering
//  of the load order page EACH time.
export const setFBForceUpdate = createAction("SET_FB_FORCE_UPDATE", (profileId: string) => ({
  profileId,
}));

// Holds a load order until the game lists the awaited mods again; an existing hold is kept.
export const holdFBLoadOrderForDeploy = createAction<IHoldFBLoadOrderPayload>(
  "HOLD_FB_LOAD_ORDER_FOR_DEPLOY",
  (
    profileId: string,
    loadOrderId: string,
    loadOrder: LoadOrder,
    awaitedVortexModIds: string[],
  ) => ({
    profileId,
    loadOrderId,
    loadOrder,
    awaitedVortexModIds,
  }),
);

export const releaseFBLoadOrderHold = createAction<IReleaseFBLoadOrderHoldPayload>(
  "RELEASE_FB_LOAD_ORDER_HOLD",
  (profileId: string, loadOrderId: string) => ({ profileId, loadOrderId }),
);

// The user opened a load order's tab.
export const fbLoadOrderTabSelected = createAction<IFBLoadOrderTabSelectedPayload>(
  "FB_LOAD_ORDER_TAB_SELECTED",
  (profileId: string, loadOrderId: string) => ({ profileId, loadOrderId }),
);

export const setValidationResult = createAction<ISetValidationResultPayload>(
  "SET_FB_VALIDATION_RESULT",
  (profileId: string, result: IValidationResult | undefined, loadOrderId?: string) => ({
    profileId,
    result,
    loadOrderId,
  }),
);
