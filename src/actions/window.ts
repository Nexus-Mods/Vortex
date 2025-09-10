import safeCreateAction from './safeCreateAction';

import * as reduxAct from 'redux-act';

const identity = <T>(input: T) => input;

export interface IWindowSize { width: number; height: number; }
export interface IWindowPosition { x: number; y: number; }

/**
 * action to set window size in the store.
 * Takes one parameter of the form {width: number, height: number}
 */
export const setWindowSize = safeCreateAction('STORE_WINDOW_SIZE', identity as (s: IWindowSize) => IWindowSize);

/**
 * action to set window position in the store.
 * Takes one parameter of the form {x: number, y: number}
 */
export const setWindowPosition = safeCreateAction('STORE_WINDOW_POSITION', identity as (p: IWindowPosition) => IWindowPosition);

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = safeCreateAction('SET_MAXIMIZED', (value: boolean) => value);

export const setZoomFactor = safeCreateAction('SET_ZOOM_FACTOR', (factor: number) => factor);

export const setTabsMinimized = safeCreateAction('SET_TABS_MINIMIZED', (minimized: boolean) => minimized);

export const setCustomTitlebar = safeCreateAction('SET_CUSTOM_TITLEBAR', (enabled: boolean) => enabled);
