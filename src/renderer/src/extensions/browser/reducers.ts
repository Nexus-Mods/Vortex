import { actionsToReducerSpec } from "@/reducers/builder";
import type { IBrowserState } from "@/types/IState";

import * as actions from "./actions";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer = actionsToReducerSpec<IBrowserState, typeof actions>(
  {
    url: undefined,
    instructions: undefined,
    subscriber: undefined,
    skippable: undefined,
  },
  actions,
  {
    showURL: (state, payload) => ({ ...state, ...payload }),
    closeBrowser: (state) => ({ ...state, url: undefined }),
  },
);
