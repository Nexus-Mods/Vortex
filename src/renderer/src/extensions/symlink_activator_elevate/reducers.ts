import update from "immutability-helper";

import type { IReducerSpec } from "../../types/IExtensionContext";
import * as actions from "./actions";

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.enableUserSymlinks as any]: (state, payload) =>
      update(state, { userSymlinks: { $set: payload } }),
  },
  defaults: {
    userSymlinks: false,
  },
};

export default settingsReducer;
