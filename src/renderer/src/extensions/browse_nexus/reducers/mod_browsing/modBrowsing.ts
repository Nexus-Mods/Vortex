import { actionsToReducerSpec } from "@/reducers/builder";

import { setHasGivenFeedback } from "../../actions/modBrowsing";

/** persistent.modBrowsing: what the user has done in mod browsing, on this device. */
export interface IModBrowsingState {
  /** Whether the user has given feedback on mod browsing. */
  hasGivenFeedback: boolean;
}

declare module "@/types/IState" {
  interface IPersistentState {
    /** What the user has done in mod browsing, on this device. */
    modBrowsing: IModBrowsingState;
  }
}

const defaultState: IModBrowsingState = { hasGivenFeedback: false };

export const modBrowsingReducer = actionsToReducerSpec(
  defaultState,
  { setHasGivenFeedback },
  {
    setHasGivenFeedback: (state, given) =>
      state.hasGivenFeedback === given ? state : { ...state, hasGivenFeedback: given },
  },
);
