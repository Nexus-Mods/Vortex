import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";
import type { IChangelogsState } from "./types";

const sessionReducer: types.IReducerSpec<IChangelogsState> = util.actionsToReducerSpec<
  IChangelogsState,
  typeof actions
>({ changelogs: [] }, actions, {
  setChangelogs: (state, payload) => util.setSafe(state, ["changelogs"], payload),
});

export default sessionReducer;
