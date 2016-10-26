import * as actions from '../actions/session';
import { IReducerSpec } from '../types/IExtensionContext';

import { setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.displayGroup]: (state, payload) => {
      return setSafe(state, [ 'displayGroups', payload.groupId ], payload.itemId);
    },
  },
  defaults: {
    displayGroups: {},
  },
};
