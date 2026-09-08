import type { IReducerSpec } from "../../../types/IExtensionContext";
import { deleteOrNop, setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/indexlock";

/**
 * reducer for the manually locked plugin indices, keyed by game then plugin id
 */
export const indexReducer: IReducerSpec = {
  reducers: {
    [actions.lockPluginIndex as any]: (state, payload) =>
      payload.index !== undefined
        ? setSafe(state, [payload.gameId, payload.plugin], payload.index)
        : deleteOrNop(state, [payload.gameId, payload.plugin]),
  },
  defaults: {},
};
