import { util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IFeedbackSessionState } from "../types/state";

/**
 * reducer for changes to the feedback files
 */
export const sessionReducer = util.actionsToReducerSpec<IFeedbackSessionState, typeof actions>(
  {
    feedbackType: undefined,
    feedbackTopic: undefined,
    feedbackTitle: "",
    feedbackMessage: "",
    feedbackHash: undefined,
    feedbackFiles: {},
  },
  actions,
  {
    setFeedbackType: (state, payload) =>
      util.setSafe(
        util.setSafe(state, ["feedbackType"], payload.feedbackType),
        ["feedbackTopic"],
        payload.feedbackTopic,
      ),
    setFeedbackTitle: (state, payload) => util.setSafe(state, ["feedbackTitle"], payload),
    setFeedbackMessage: (state, payload) => util.setSafe(state, ["feedbackMessage"], payload),
    setFeedbackHash: (state, payload) => util.setSafe(state, ["feedbackHash"], payload),
    addFeedbackFile: (state, payload) => {
      const { feedbackFile } = payload;
      return util.setSafe(state, ["feedbackFiles", feedbackFile.filename], feedbackFile);
    },
    removeFeedbackFile: (state, payload) => {
      const { feedbackFileId } = payload;
      return util.deleteOrNop(state, ["feedbackFiles", feedbackFileId]);
    },
    clearFeedbackFiles: (state) => util.setSafe(state, ["feedbackFiles"], {}),
  },
);
