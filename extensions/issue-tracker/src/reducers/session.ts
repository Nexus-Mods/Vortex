import { util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IIssuesSessionState } from "../types";

const sessionReducer = util.actionsToReducerSpec<IIssuesSessionState, typeof actions>(
  {
    feedbackResponderOpen: false,
    oustandingIssues: null,
  },
  actions,
  {
    openFeedbackResponder: (state, open) => util.setSafe(state, ["feedbackResponderOpen"], open),
    setOutstandingIssues: (state, issues) => util.setSafe(state, ["oustandingIssues"], issues),
  },
);

export default sessionReducer;
