import * as actions from "../actions/window";
import { actionsToReducerSpec } from "./builder";

export const defaultState = {
  maximized: false,
  zoomFactor: 1.0,
  position: { x: 0, y: 0 },
  size: {},
  tabsMinimized: false,
  customTitlebar: true,
  useModernLayout: true,
};

/**
 * reducer for changes to the window state
 */
export const windowReducer = actionsToReducerSpec(defaultState, actions, {
  setCustomTitlebar: (state, payload) => ({ ...state, customTitlebar: payload }),
  setMaximized: (state, payload) => ({ ...state, maximized: payload }),
  setTabsMinimized: (state, payload) => ({ ...state, tabsMinimized: payload }),
  setUseModernLayout: (state, payload) => ({ ...state, useModernLayout: payload }),
  setWindowPosition: (state, payload) => ({ ...state, position: payload }),
  setWindowSize: (state, payload) => ({ ...state, size: payload }),
  setZoomFactor: (state, payload) => ({ ...state, zoomFactor: payload }),
});
