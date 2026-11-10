import { actionsToReducerSpec } from "@/reducers/builder";
import type { IDiscoveryState } from "@/types/IState";

import * as actions from "../actions/discovery";

const defaultState: IDiscoveryState = {
  running: false,
  phases: {},
};

/**
 * reducer for changes to the known mods
 */
export const discoveryReducer = actionsToReducerSpec(defaultState, actions, {
  setPhaseCount: (state, count) => {
    const phases: IDiscoveryState["phases"] = {};
    for (let i = 0; i < count; ++i) {
      phases[i] = { progress: 0, directory: "" };
    }

    return { ...state, phases };
  },
  discoveryProgress: (state, payload) =>
    state.phases[payload.idx] === undefined
      ? state
      : {
          ...state,
          running: true,
          phases: {
            ...state.phases,
            [payload.idx]: {
              progress: payload.percent,
              directory: payload.directory,
            },
          },
        },
  discoveryFinished: (state) => ({
    ...state,
    running: false,
    phases: [],
  }),
});
