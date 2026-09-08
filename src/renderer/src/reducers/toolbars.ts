import type { IToolbarStates } from "@/types/IState";

import * as actions from "../actions/toolbars";
import { actionsToReducerSpec } from "./builder";

const defaultState: IToolbarStates = {};

/**
 * What the user has decided about the actions on each toolbar that offers pinning.
 *
 * Only decisions are stored, never the whole picture: an action is absent until the
 * user pins or unpins it, and until then it sits wherever its own `pinned` default
 * puts it. So changing a default later moves it for everyone who never had an
 * opinion, and an action that no longer exists — an extension since removed — is a
 * stale key rather than a phantom on someone's toolbar.
 */
export const toolbarReducer = actionsToReducerSpec(defaultState, actions, {
  setActionPinned: (state, payload) => {
    const { toolbarId, actionId, pinned } = payload;
    const toolbar = state[toolbarId] ?? { pinned: {} };

    return {
      ...state,
      [toolbarId]: {
        ...toolbar,
        pinned: { ...toolbar.pinned, [actionId]: pinned },
      },
    };
  },
  resetPinnedActions: (state, payload) => {
    // drop the toolbar's entry rather than emptying it: "no decisions" is the
    // absence of a record, which is also the state a new install is in
    const { [payload.toolbarId]: removed, ...rest } = state;
    void removed;

    return rest;
  },
});
