import update from "immutability-helper";

import { actionsToPartialReducerSpec } from "../../reducers/builder";
import type { ISettingsWorkarounds } from "../../types/IState";
import * as actions from "./actions";

/**
 * reducer for the user symlinks workaround. settings.workarounds is shared with other extensions'
 * workarounds, so this supplies the default for userSymlinks only.
 */
const settingsReducer = actionsToPartialReducerSpec<ISettingsWorkarounds, typeof actions>(
  {
    userSymlinks: false,
  },
  actions,
  {
    enableUserSymlinks: (state, payload) => update(state, { userSymlinks: { $set: payload } }),
  },
);

export default settingsReducer;
