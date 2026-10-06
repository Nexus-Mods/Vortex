import { generate } from "shortid";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/session";
import { DEFAULT_LOAD_ORDER_ID, type IValidationResult } from "../types/types";

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
  // keyed by profile id, then by load order id
  validationResult?: Record<string, Record<string, IValidationResult | undefined>>;
  heldForDeploy?: HeldLoadOrders;
  // the load order whose tab is open, keyed by profile id
  activeLoadOrder?: Record<string, string>;
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
  fbLoadOrderTabSelected: (state, { profileId, loadOrderId }) => ({
    ...state,
    activeLoadOrder: { ...state.activeLoadOrder, [profileId]: loadOrderId },
  }),
  setValidationResult: (state, { profileId, result, loadOrderId }) => ({
    ...state,
    validationResult: {
      ...state.validationResult,
      [profileId]: {
        ...state.validationResult?.[profileId],
        [loadOrderId ?? DEFAULT_LOAD_ORDER_ID]: result,
      },
    },
  }),
});
