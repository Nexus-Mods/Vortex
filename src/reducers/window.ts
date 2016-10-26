import * as actions from '../actions/window';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const windowReducer: IReducerSpec = {
  reducers: {
    [actions.setWindowSize]: (state, payload) => update(state, { size: { $set: payload } }),
    [actions.setWindowPosition]: (state, payload) => update(state, { position: { $set: payload } }),
    [actions.setMaximized]: (state, payload) => update(state, { maximized: { $set: payload } }),
  },
  defaults: {
    maximized: false,
    position: { x: 0, y: 0 },
    size: {
      height: 768,
      width: 1024,
    },
  },
};
