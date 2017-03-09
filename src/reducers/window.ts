import * as actions from '../actions/window';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const windowReducer: IReducerSpec = {
  reducers: {
    [actions.setWindowSize as any]: (state, payload) => update(state, { size: { $set: payload } }),
    [actions.setWindowPosition as any]: (state, payload) =>
     update(state, { position: { $set: payload } }),
    [actions.setMaximized as any]: (state, payload) =>
     update(state, { maximized: { $set: payload } }),
    [actions.setTabsMinimized as any]: (state, payload) =>
      update(state, { tabsMinimized: { $set: payload } }),
  },
  defaults: {
    maximized: false,
    position: { x: 0, y: 0 },
    size: {
      height: 768,
      width: 1024,
    },
    tabsMinimized: false,
  },
};
