import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { FeedbackTopic, FeedbackType } from "../types/feedbackTypes";
import type { IFeedbackFile } from "../types/IFeedbackFile";
import type { IFeedbackSessionState } from "../types/state";

/**
 * reducer for changes to the feedback files
 */
export const sessionReducer: types.IReducerSpec<IFeedbackSessionState> = {
  reducers: {
    [actions.setFeedbackType as any]: (
      state: IFeedbackSessionState,
      payload: { feedbackType: FeedbackType; feedbackTopic: FeedbackTopic },
    ) =>
      util.setSafe(
        util.setSafe(state, ["feedbackType"], payload.feedbackType),
        ["feedbackTopic"],
        payload.feedbackTopic,
      ),
    [actions.setFeedbackTitle as any]: (state: IFeedbackSessionState, payload: string) =>
      util.setSafe(state, ["feedbackTitle"], payload),
    [actions.setFeedbackMessage as any]: (state: IFeedbackSessionState, payload: string) =>
      util.setSafe(state, ["feedbackMessage"], payload),
    [actions.setFeedbackHash as any]: (state: IFeedbackSessionState, payload: string) =>
      util.setSafe(state, ["feedbackHash"], payload),
    [actions.addFeedbackFile as any]: (
      state: IFeedbackSessionState,
      payload: { feedbackFile: IFeedbackFile },
    ) => {
      const { feedbackFile } = payload;
      return util.setSafe(state, ["feedbackFiles", feedbackFile.filename], feedbackFile);
    },
    [actions.removeFeedbackFile as any]: (
      state: IFeedbackSessionState,
      payload: { feedbackFileId: string },
    ) => {
      const { feedbackFileId } = payload;
      return util.deleteOrNop(state, ["feedbackFiles", feedbackFileId]);
    },
    [actions.clearFeedbackFiles as any]: (state: IFeedbackSessionState, payload) =>
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
