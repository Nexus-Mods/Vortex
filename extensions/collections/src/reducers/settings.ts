import { types, util } from "vortex-api";

import * as actions from "../actions/settings";

const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSortAdded as any]: (state, payload) => {
      const { sorting } = payload;
      return util.setSafe(state, ["sortAdded"], sorting);
    },
    [actions.setSortWorkshop as any]: (state, payload) => {
      const { sorting } = payload;
      return util.setSafe(state, ["sortWorkshop"], sorting);
    },
  },
  defaults: {
    sortAdded: "datedownloaded",
    sortWorkshop: "recentlyupdated",
  },
};

export default settingsReducer;
