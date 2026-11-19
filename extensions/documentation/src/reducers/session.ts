import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { ITutorialsSessionState } from "../types/state";

// reducer for changes to ephemeral session state
const INVALID_TUTORIAL_ID: number = -1;

const sessionReducer: types.IReducerSpec<ITutorialsSessionState> = util.actionsToReducerSpec<
  ITutorialsSessionState,
  typeof actions
>(
  {
    currentTutorial: {
      tutorialId: INVALID_TUTORIAL_ID,
      isOpen: false,
    },
  },
  actions,
  {
    setTutorialOpen: (state, payload) => {
      const { tutorialId, isOpen } = payload;
      // If the tutorial id has changed; it's safe to assume that the user
      //  has clicked a new tutorial and he wants it displayed; reason why
      //  we force the isOpen variable to true.
      const vidOpen = state.currentTutorial.tutorialId !== payload.tutorialId ? true : isOpen;

      return util.setSafe(state, ["currentTutorial"], {
        tutorialId,
        isOpen: vidOpen,
      });
    },

    closeTutorials: (state) =>
      util.setSafe(state, ["currentTutorial"], {
        tutorialId: INVALID_TUTORIAL_ID,
        isOpen: false,
      }),
  },
);

export default sessionReducer;
