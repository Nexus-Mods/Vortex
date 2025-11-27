import { types, util } from 'vortex-api';

import * as actions from '../actions/session';

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.openFeedbackResponder as any]: (state, open) => {
      return util.setSafe(state, ['feedbackResponderOpen'], open);
    },
    [actions.setOutstandingIssues as any]: (state, issues) => {
      return util.setSafe(state, ['oustandingIssues'], issues);
    },
  },
  defaults: {
    feedbackResponderOpen: false,
    oustandingIssues: null,
  },
};

export default sessionReducer;
