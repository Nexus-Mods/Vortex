import { createAction } from 'redux-act';

/** action to set window size in the store. Takes one parameter of the form {width: number, height: number} */
export const setWindowSize = createAction('change window size');

/** action to set window position in the store. Takes one parameter of the form {x: number, y: number} */
export const setWindowPosition = createAction('change window position');

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = createAction('set window maximized');
