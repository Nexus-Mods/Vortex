import * as actions from "../actions/session";

import { types, util } from "vortex-api";

/**
 * reducer for changes to the feedback files
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setFeedbackType as any]: (state, payload) =>
      util.setSafe(
        util.setSafe(state, ["feedbackType"], payload.feedbackType),
        ["feedbackTopic"],
        payload.feedbackTopic,
      ),
    [actions.setFeedbackTitle as any]: (state, payload) =>
      util.setSafe(state, ["feedbackTitle"], payload),
    [actions.setFeedbackMessage as any]: (state, payload) =>
      util.setSafe(state, ["feedbackMessage"], payload),
    [actions.setFeedbackHash as any]: (state, payload) =>
      util.setSafe(state, ["feedbackHash"], payload),
    [actions.addFeedbackFile as any]: (state, payload) => {
      const { feedbackFile } = payload;
      return util.setSafe(
        state,
        ["feedbackFiles", feedbackFile.filename],
        feedbackFile,
      );
    },
    [actions.removeFeedbackFile as any]: (state, payload) => {
      const { feedbackFileId } = payload;
      return util.deleteOrNop(state, ["feedbackFiles", feedbackFileId]);
    },
    [actions.clearFeedbackFiles as any]: (state, payload) =>
      util.setSafe(state, ["feedbackFiles"], {}),
  },
  defaults: {
    feedbackType: undefined,
    feedbackTopic: undefined,
    feedbackTitle: "",
    feedbackMessage: "",
    feedbackHash: undefined,
    feedbackFiles: {},
  },
};
