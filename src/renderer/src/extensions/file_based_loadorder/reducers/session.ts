import { generate } from "shortid";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/session";
import type { IValidationResult } from "../types/types";

// A load order kept while its mods change, until the game lists the awaited mods again.
export type IHeldLoadOrder = Pick<
  actions.IHoldFBLoadOrderPayload,
  "loadOrder" | "awaitedVortexModIds"
>;

// keyed by profile id, then by load order id
type HeldLoadOrders = Record<string, Record<string, IHeldLoadOrder>>;

export interface IFBLOSessionState {
  // keyed by profile id
  refresh?: Record<string, string>;
  // keyed by profile id
  validationResult?: Record<string, IValidationResult>;
  heldForDeploy?: HeldLoadOrders;
}

declare module "@/types/IState" {
  interface ISessionState {
    fblo: IFBLOSessionState;
  }
}

export const sessionReducer: IReducerSpec<IFBLOSessionState> = {
  reducers: {
    [actions.setFBForceUpdate.getType()]: (state, payload: { profileId: string }) => {
      const { profileId } = payload;
      const uId = generate();
      return setSafe(state, ["refresh", profileId], uId);
    },
    [actions.holdFBLoadOrderForDeploy.getType()]: (
      state,
      { profileId, loadOrderId, loadOrder, awaitedVortexModIds }: actions.IHoldFBLoadOrderPayload,
    ) => {
      const held = state.heldForDeploy ?? {};
      if (held[profileId]?.[loadOrderId] !== undefined) {
        return state;
      }
      return {
        ...state,
        heldForDeploy: {
          ...held,
          [profileId]: { ...held[profileId], [loadOrderId]: { loadOrder, awaitedVortexModIds } },
        },
      };
    },
    [actions.releaseFBLoadOrderHold.getType()]: (
      state,
      { profileId, loadOrderId }: actions.IReleaseFBLoadOrderHoldPayload,
    ) => {
      const held = state.heldForDeploy ?? {};
      if (held[profileId]?.[loadOrderId] === undefined) {
        return state;
      }
      const { [loadOrderId]: _released, ...remaining } = held[profileId];
      return { ...state, heldForDeploy: { ...held, [profileId]: remaining } };
    },
    [actions.setValidationResult.getType()]: (
      state,
      payload: { profileId: string; result: IValidationResult },
    ) => {
      const { profileId, result } = payload;
      return setSafe(state, ["validationResult", profileId], result);
    },
  },
  defaults: {},
};
