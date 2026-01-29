import { types, util } from "vortex-api";

import * as actions from "./actions";

/**
 * reducer for changes to the plugin list
 */
export const indexReducer: types.IReducerSpec = {
  reducers: {
    [actions.lockPluginIndex as any]: (state, payload) =>
      payload.index !== undefined
        ? util.setSafe(state, [payload.gameId, payload.plugin], payload.index)
        : util.deleteOrNop(state, [payload.gameId, payload.plugin]),
  },
  defaults: {},
};
