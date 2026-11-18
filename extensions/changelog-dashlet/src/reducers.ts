import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";
import type { Changelog, IChangelogsState } from "./types";

const sessionReducer: types.IReducerSpec<IChangelogsState> = {
  reducers: {
    [actions.setChangelogs as any]: (state: IChangelogsState, payload: Changelog[]) =>
      util.setSafe(state, ["changelogs"], payload),
  },
  defaults: {
    changelogs: [],
  },
};

export default sessionReducer;
