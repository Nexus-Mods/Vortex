import { types, util } from 'vortex-api';

import * as actions from '../actions/persistent';

const persistentReducer: types.IReducerSpec = {
  reducers: {
    [actions.updateIssueList as any]: (state, payload) => {
      let cur = state;
      Object.keys(state.issues).forEach(issueId => {
        if (payload.indexOf(issueId) === -1) {
          cur = util.deleteOrNop(cur, ['issues', issueId]);
        }
        payload.forEach(issueId => {
          if (state.issues[issueId] === undefined) {
            cur = util.setSafe(cur, ['issues', issueId], {});
          }
        });
      });
      return cur;
    },
    [actions.setUpdateDetails as any]: (state, { issueId, details }) =>
      util.setSafe(state, ['issues', issueId], details),
  },
  defaults: {
    issues: {},
  },
};

export default persistentReducer;
