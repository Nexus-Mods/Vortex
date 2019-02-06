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
    [actions.setZoomFactor as any]: (state, payload) =>
      setSafe(state, ['zoomFactor'], payload),
    [actions.setTabsMinimized as any]: (state, payload) =>
      setSafe(state, ['tabsMinimized'], payload),
    [actions.setCustomTitlebar as any]: (state, payload) =>
      setSafe(state, ['customTitlebar'], payload),
  },
  defaults: {
    maximized: false,
    zoomFactor: 1.0,
    position: { x: 0, y: 0 },
    size: {},
    tabsMinimized: false,
    customTitlebar: true,
  },
};
