import type { ISplitStates } from "@/types/IState";

import * as actions from "../actions/splits";
import { actionsToReducerSpec } from "./builder";

const defaultState: ISplitStates = {};

/**
 * Where the user left each resizable split. A split is absent until they move it, and until then
 * it sits wherever its own default puts it.
 */
export const splitReducer = actionsToReducerSpec(defaultState, actions, {
  setSplit: (state, payload) => ({ ...state, [payload.splitId]: payload.split }),
});
