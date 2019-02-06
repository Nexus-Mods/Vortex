import safeCreateAction from './safeCreateAction';

import * as reduxAct from 'redux-act';

const identity = input => input;

/**
 * action to set window size in the store.
 * Takes one parameter of the form {width: number, height: number}
 */
export const setWindowSize = safeCreateAction('STORE_WINDOW_SIZE', identity);

/**
 * action to set window position in the store.
 * Takes one parameter of the form {x: number, y: number}
 */
export const setWindowPosition = safeCreateAction('STORE_WINDOW_POSITION', identity);

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = safeCreateAction('SET_MAXIMIZED', identity);

export const setZoomFactor = safeCreateAction('SET_ZOOM_FACTOR', identity);

export const setTabsMinimized = safeCreateAction('SET_TABS_MINIMIZED', identity);

export const setCustomTitlebar = safeCreateAction('SET_CUSTOM_TITLEBAR', identity);
