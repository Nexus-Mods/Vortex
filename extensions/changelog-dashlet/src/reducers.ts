import { types, util } from "vortex-api";

import * as actions from "./actions";

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setChangelogs as any]: (state, payload) =>
      util.setSafe(state, ["changelogs"], payload),
  },
  defaults: {
    changelogs: [],
  },
};

export default sessionReducer;
