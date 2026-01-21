import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";

import * as actions from "../actions/session";

/**
 * Reducer for the add_new_mod extension session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [actions.showAddModDialog as any]: (state, payload: boolean) =>
      setSafe(state, ["showDialog"], payload),
  },
  defaults: {
    showDialog: false,
  },
};
