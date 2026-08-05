import { createAction } from "redux-act";

const identity = <T>(input: T): T => input;

/**
 * action to set window size in the store.
 */
export const setWindowSize = createAction(
  "STORE_WINDOW_SIZE",
  identity<{ width: number; height: number }>,
);

/**
 * action to set window position in the store.
 */
export const setWindowPosition = createAction(
  "STORE_WINDOW_POSITION",
  identity<{ x: number; y: number }>,
);

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = createAction("SET_MAXIMIZED", identity<boolean>);

export const setZoomFactor = createAction("SET_ZOOM_FACTOR", identity<number>);

export const setTabsMinimized = createAction("SET_TABS_MINIMIZED", identity<boolean>);

export const setCustomTitlebar = createAction("SET_CUSTOM_TITLEBAR", identity<boolean>);

export const setUseModernLayout = createAction("SET_USE_MODERN_LAYOUT", identity<boolean>);
