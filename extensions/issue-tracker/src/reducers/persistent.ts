import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/persistent";
import type { IGithubIssueCache } from "../IGithubIssue";
import type { IIssuesPersistentState } from "../types";

const persistentReducer: types.IReducerSpec<IIssuesPersistentState> = {
  reducers: {
    [actions.updateIssueList as any]: (state: IIssuesPersistentState, payload: string[]) => {
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
    [actions.setUpdateDetails as any]: (
      state: IIssuesPersistentState,
      { issueId, details }: { issueId: string; details: IGithubIssueCache },
    ) => util.setSafe(state, ["issues", issueId], details),
  },
  defaults: {
    issues: {},
  },
};

export default persistentReducer;
