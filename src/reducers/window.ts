import * as actions from '../actions/window';
import { IReducerSpec } from '../types/IExtensionContext';
import {setSafe} from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const windowReducer: IReducerSpec = {
  reducers: {
    [actions.setWindowSize as any]: (state, payload) =>
      setSafe(state, ['size'], payload),
    [actions.setWindowPosition as any]: (state, payload) =>
      setSafe(state, ['position'], payload),
    [actions.setMaximized as any]: (state, payload) =>
      setSafe(state, ['maximized'], payload),
    [actions.setTabsMinimized as any]: (state, payload) =>
      setSafe(state, ['tabsMinimized'], payload),
  },
  defaults: {
    maximized: false,
    position: { x: 0, y: 0 },
    size: {},
    tabsMinimized: false,
  },
};
