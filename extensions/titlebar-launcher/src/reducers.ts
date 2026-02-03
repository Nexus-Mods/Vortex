import { types, util } from "vortex-api";
import * as actions from "./actions";

const reducer: types.IReducerSpec = {
  reducers: {
    [actions.setAddToTitleBar as any]: (state, payload) => {
      const { addToTitleBar } = payload;
      return util.setSafe(
        state,
        ["tools", "addToolsToTitleBar"],
        addToTitleBar,
      );
    },
  },
  defaults: {},
};

export default reducer;
