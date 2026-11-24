import { actionsToReducerSpec } from "@/reducers/builder";
import type { IOverlaysState } from "@/types/IState";

import * as actions from "./actions";

const sessionReducer = actionsToReducerSpec<IOverlaysState, typeof actions>(
  { overlays: {} },
  actions,
  {
    showOverlay: (state, payload) => ({
      ...state,
      overlays: {
        ...state.overlays,
        [payload.id]: {
          title: payload.title,
          content: payload.content,
          componentId: payload.componentId,
          position: payload.pos,
          options: payload.options,
        },
      },
    }),
    dismissOverlay: (state, payload) => {
      if (state.overlays === undefined || !Object.hasOwn(state.overlays, payload)) {
        return state;
      }
      const { [payload]: _, ...overlays } = state.overlays;
      return { ...state, overlays };
    },
  },
);

export default sessionReducer;
