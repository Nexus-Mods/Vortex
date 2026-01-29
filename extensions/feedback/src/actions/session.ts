import { IFeedbackFile } from "../types/IFeedbackFile";
import { FeedbackTopic, FeedbackType } from "../types/feedbackTypes";

import { createAction } from "redux-act";

export const setFeedbackType = createAction(
  "SET_FEEDBACK_TYPE",
  (feedbackType: FeedbackType, feedbackTopic: FeedbackTopic) => ({
    feedbackType,
    feedbackTopic,
  }),
);

export const setFeedbackTitle = createAction(
  "SET_FEEDBACK_TITLE",
  (feedbackTitle: string) => feedbackTitle,
);

export const setFeedbackMessage = createAction(
  "SET_FEEDBACK_MESSAGE",
  (feedbackMessage: string) => feedbackMessage,
);

export const setFeedbackHash = createAction(
  "SET_FEEDBACK_HASH",
  (hash: string) => hash,
);

export const addFeedbackFile = createAction(
  "ADD_FEEDBACK_FILE",
  (feedbackFile: IFeedbackFile) => ({ feedbackFile }),
);

export const removeFeedbackFile = createAction(
  "REMOVE_FEEDBACK_FILE",
  (feedbackFileId: string) => ({ feedbackFileId }),
);

export const clearFeedbackFiles = createAction("CLEAR_FEEDBACK_FILES");
