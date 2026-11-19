import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/persistent";
import type { IIssuesPersistentState } from "../types";

const persistentReducer: types.IReducerSpec<IIssuesPersistentState> = util.actionsToReducerSpec<
  IIssuesPersistentState,
  typeof actions
>({ issues: {} }, actions, {
  updateIssueList: (state, payload) => {
    let cur = state;
    Object.keys(state.issues).forEach((issueId) => {
      if (payload.indexOf(issueId) === -1) {
        cur = util.deleteOrNop(cur, ["issues", issueId]);
      }
      payload.forEach((issueId) => {
        if (state.issues[issueId] === undefined) {
          cur = util.setSafe(cur, ["issues", issueId], {});
        }
      });
    });
    return cur;
  },
  setUpdateDetails: (state, { issueId, details }) =>
    util.setSafe(state, ["issues", issueId], details),
});

export default persistentReducer;
