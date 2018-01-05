import safeCreateAction from './safeCreateAction';

/**
 * action to set window size in the store.
 * Takes one parameter of the form {width: number, height: number}
 */
export const setWindowSize = safeCreateAction('STORE_WINDOW_SIZE');

/**
 * action to set window position in the store.
 * Takes one parameter of the form {x: number, y: number}
 */
export const setWindowPosition = safeCreateAction('STORE_WINDOW_POSITION');

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = safeCreateAction('SET_MAXIMIZED');

export const setTabsMinimized = safeCreateAction('SET_TABS_MINIMIZED');

export const setCustomTitlebar = safeCreateAction('SET_CUSTOM_TITLEBAR');
