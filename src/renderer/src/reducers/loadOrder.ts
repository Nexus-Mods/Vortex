import * as actions from "../actions/loadOrder";
import { actionsToReducerSpec } from "./builder";

const defaultState: Record<string, unknown[]> = {};

export const loReducer = actionsToReducerSpec(defaultState, actions, {
  setLoadOrder: (state, payload) => ({ ...state, [payload.id]: payload.order }),
});
