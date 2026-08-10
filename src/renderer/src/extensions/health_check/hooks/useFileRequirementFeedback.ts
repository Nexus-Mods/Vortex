import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { setFeedbackGiven } from "../actions/persistent";
import { feedbackGivenMap } from "../selectors";

/** Per-source-file feedback state; file-level feedback is keyed by the source file UID. */
export const useFileRequirementFeedback = (api: IExtensionApi, sourceFileUID: string) => {
  const feedbackKey = Number(sourceFileUID);
  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedback = (feedbackMap[feedbackKey] ?? []).includes(sourceFileUID);
  const markFeedback = () => api.store?.dispatch(setFeedbackGiven(feedbackKey, sourceFileUID));
  return { givenFeedback, markFeedback };
};
