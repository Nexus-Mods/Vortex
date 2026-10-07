import { generate } from "shortid";

import { actionsToReducerSpec } from "../../../reducers/builder";
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

export const sessionReducer = actionsToReducerSpec<IFBLOSessionState, typeof actions>({}, actions, {
  setFBForceUpdate: (state, { profileId }) => ({
    ...state,
    refresh: { ...state.refresh, [profileId]: generate() },
  }),
  holdFBLoadOrderForDeploy: (state, { profileId, loadOrderId, loadOrder, awaitedVortexModIds }) => {
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
  releaseFBLoadOrderHold: (state, { profileId, loadOrderId }) => {
    const held = state.heldForDeploy ?? {};
    if (held[profileId]?.[loadOrderId] === undefined) {
      return state;
    }
    const { [loadOrderId]: _released, ...remaining } = held[profileId];
    return { ...state, heldForDeploy: { ...held, [profileId]: remaining } };
  },
  setValidationResult: (state, { profileId, result }) => ({
    ...state,
    validationResult: { ...state.validationResult, [profileId]: result },
  }),
});
