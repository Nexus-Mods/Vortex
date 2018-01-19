import * as actions from '../actions/session';

import * as update from 'immutability-helper';
import { types, util } from 'vortex-api';

/**
 * reducer for changes to the feedback files
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setFeedbackMessage as any]: (state, payload) =>
      util.setSafe(state, ['feedbackMessage'], payload),
    [actions.addFeedbackFile as any]: (state, payload) => {
      const { feedbackFile } = payload;
      return util.setSafe(state, ['feedbackFiles', feedbackFile.filename], feedbackFile);
    },
    [actions.removeFeedbackFile as any]: (state, payload) => {
      const { feedbackFileId } = payload;
      return util.deleteOrNop(state, ['feedbackFiles', feedbackFileId]);
    },
    [actions.clearFeedbackFiles as any]: (state, payload) =>
      update(state, { feedbackFiles: { $set: {} } }),
  },
  defaults: {
    feedbackMessage: '',
    feedbackFiles: {},
  },
};
