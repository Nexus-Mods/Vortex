import update from "immutability-helper";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/session";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setKnownGames as any]: (state, payload) => update(state, { known: { $set: payload } }),
    [actions.setGameDisabled as any]: (state, payload) =>
      setSafe(state, ["disabled", payload.gameId], payload.disabledBy),
    [actions.clearGameDisabled as any]: (state, payload) =>
      update(state, { disabled: { $set: {} } }),
  },
  defaults: {
    known: [],
    disabled: {},
  },
};
