import { actionsToPartialReducerSpec } from "@/reducers/builder";
import type { ISettingsInterface } from "@/types/IState";

import * as actions from "./actions";

/**
 * settings.interface is shared with settings_interface and the dashboard; this reducer owns only
 * the tool settings and the primary tool, neither of which has a default.
 */
const reducer = actionsToPartialReducerSpec<ISettingsInterface, typeof actions>({}, actions, {
  setPrimaryTool: (state, payload) => ({
    ...state,
    primaryTool: { ...state.primaryTool, [payload.gameId]: payload.toolId },
  }),
  setToolOrder: (state, payload) => {
    const { gameId, tools } = payload;
    return {
      ...state,
      tools: { ...state.tools, order: { ...state.tools?.order, [gameId]: tools } },
    };
  },
  setToolValid: (state, payload) => {
    const { gameId, toolId, valid } = payload;
    const current = state.tools?.valid;
    return {
      ...state,
      tools: {
        ...state.tools,
        valid: { ...current, [gameId]: { ...current?.[gameId], [toolId]: valid } },
      },
    };
  },
  setToolPinned: (state, payload) => {
    const { gameId, toolId, pinned } = payload;
    return {
      ...state,
      tools: {
        ...state.tools,
        pinned: {
          ...state.tools?.pinned,
          [gameId]: { ...state.tools?.pinned?.[gameId], [toolId]: pinned },
        },
      },
    };
  },
});

export default reducer;
