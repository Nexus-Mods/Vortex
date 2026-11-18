import type { FeedbackTopic, FeedbackType } from "./feedbackTypes";
import type { IFeedbackFile } from "./IFeedbackFile";

export interface IFeedbackSessionState {
  feedbackType: FeedbackType | undefined;
  feedbackTopic: FeedbackTopic | undefined;
  feedbackTitle: string;
  feedbackMessage: string;
  feedbackHash: string | undefined;
  feedbackFiles: { [fileId: string]: IFeedbackFile };
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      feedback: IFeedbackSessionState;
    }
  }
}
