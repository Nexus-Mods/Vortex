import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import { setSafe } from "../../../renderer/util/storeHelper";

import * as actions from "../actions/session";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.showCategoriesDialog as any]: (state, payload) =>
      setSafe(state, ["showDialog"], payload),
  },
  defaults: {
    showDialog: false,
  },
};
