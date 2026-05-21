import update from "immutability-helper";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setAnalytics } from "../actions/analytics.action";

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setAnalytics as any]: (state, payload) => update(state, { enabled: { $set: payload } }),
  },
  defaults: {
    enabled: undefined, // TODO, set me to false
  },
};

export default settingsReducer;
