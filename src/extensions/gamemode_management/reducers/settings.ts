import { IReducerSpec } from '../../../types/IExtensionContext';
import { merge, pushSafe, removeValue, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/settings';
import { addSearchPath, removeSearchPath, setGameHidden } from '../actions/settings';
import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setGameMode]: (state, payload) => {
      return update(state, { current: { $set: payload } });
    },
    [actions.addDiscoveredGame]: (state, payload) => {
      // don't replace previously discovered tools as the settings
      // there may also be user configuration
      return merge(state, ['discovered', payload.id], payload.result);
    },
    [actions.addDiscoveredTool]: (state, payload) => {
      return setSafe(state,
                     ['discovered', payload.gameId, 'tools', payload.toolId],
                     payload.result);
    },
    [actions.hideDiscoveredTool]: (state, payload) => {
      return setSafe(state,
                     ['discovered', payload.gameId, 'tools', payload.toolId, 'hidden'],
                     true);
    },
    [actions.setGameHidden]: (state, payload) => {
      return setSafe(state, ['discovered', payload.gameId, 'hidden'], payload.hidden);
    },
    [actions.addSearchPath]: (state, payload) => {
      return pushSafe(state, ['searchPaths'], payload);
    },
    [actions.removeSearchPath]: (state, payload) => {
      return removeValue(state, ['searchPaths'], payload);
    },
  },
  defaults: {
    current: undefined,
    searchPaths: undefined,
    discovered: {},
  },
};
