import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/settings";

const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setSortAdded as any]: (state, payload) => {
      const { sorting } = payload;
      return setSafe(state, ["sortAdded"], sorting);
    },
    [actions.setSortWorkshop as any]: (state, payload) => {
      const { sorting } = payload;
      return setSafe(state, ["sortWorkshop"], sorting);
    },
  },
  defaults: {
    sortAdded: "datedownloaded",
    sortWorkshop: "recentlyupdated",
  },
};

export default settingsReducer;
