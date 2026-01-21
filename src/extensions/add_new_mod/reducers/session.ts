import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";

import * as actions from "../actions/session";

/**
 * Reducer for the add_new_mod extension session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.showAddModDialog as any]: (state, payload) =>
      setSafe(state, ["showDialog"], payload),
  },
  defaults: {
    showDialog: false,
  },
};
