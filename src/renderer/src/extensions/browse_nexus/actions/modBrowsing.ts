import { createAction } from "redux-act";

/** Records whether the user has given feedback on mod browsing. */
export const setHasGivenFeedback = createAction(
  "SET_MOD_BROWSING_HAS_GIVEN_FEEDBACK",
  (given: boolean) => given,
);
