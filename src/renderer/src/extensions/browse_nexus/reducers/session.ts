import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/session";
import type { BrowseSection } from "../util/browseSection";

/** session.browse: Browse's open section, kept until a restart. */
export interface IBrowseSessionState {
  /** The open section; none for Browse's default. */
  section?: BrowseSection;
}

declare module "@/types/IState" {
  interface ISessionState {
    browse: IBrowseSessionState;
  }
}

export const sessionReducer = actionsToReducerSpec<IBrowseSessionState, typeof actions>(
  {},
  actions,
  { setBrowseSection: (state, payload) => ({ ...state, section: payload }) },
);
