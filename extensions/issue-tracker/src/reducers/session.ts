import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IIssuesSessionState, IOutstandingIssue } from "../types";

const sessionReducer: types.IReducerSpec<IIssuesSessionState> = {
  reducers: {
    [actions.openFeedbackResponder as any]: (state: IIssuesSessionState, open: boolean) => {
      return util.setSafe(state, ["feedbackResponderOpen"], open);
    },
    [actions.setOutstandingIssues as any]: (
      state: IIssuesSessionState,
      issues: IOutstandingIssue[],
    ) => {
      return util.setSafe(state, ["oustandingIssues"], issues);
    },
  },
  defaults: {
    feedbackResponderOpen: false,
    oustandingIssues: null,
  },
};

export default sessionReducer;
