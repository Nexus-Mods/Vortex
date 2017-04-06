import * as actions from '../actions/session';
import { IReducerSpec } from '../types/IExtensionContext';

import { setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.displayGroup as any]: (state, payload) =>
      setSafe(state, [ 'displayGroups', payload.groupId ], payload.itemId),
    [actions.setOverlayOpen as any]: (state, payload) =>
      setSafe(state, [ 'overlayOpen' ], payload.open),
  },
  defaults: {
    displayGroups: {},
    overlayOpen: false,
  },
};
