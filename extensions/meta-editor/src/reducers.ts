import { types, util } from "vortex-api";

import * as actions from "./actions";

/**
 * reducer for changes to ephemeral session state
 */
const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setShowMetaEditor as any]: (state, payload) =>
      util.setSafe(state, ["showDialog"], payload),
  },
  defaults: {
    showDialog: false,
  },
};

export default sessionReducer;
