import { IReducerSpec } from '../../../types/IExtensionContext';
import { merge, pushSafe, removeValue, setSafe } from '../../../util/storeHelper';
import { addDiscoveredGame, addDiscoveredTool, removeDiscoveredTool, setGameMode } from '../actions/settings';
import { addSearchPath, removeSearchPath, setGameHidden } from '../actions/settings';
import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setGameMode]: (state, payload) => {
      return update(state, { current: { $set: payload } });
    },
    [addDiscoveredGame]: (state, payload) => {
      // don't replace previously discovered tools as the settings
      // there may also be user configuration
      return merge(state, ['discovered', payload.id], payload.result);
    },
    [addDiscoveredTool]: (state, payload) => {
      return setSafe(state,
                     ['discovered', payload.gameId, 'tools', payload.toolId],
                     payload.result);
    },
    [removeDiscoveredTool]: (state, payload) => {
      const idx = state.discovered[state.current].tools[payload.toolId.id];
      return update(state, {
        discovered: {
          [payload.gameId]: {
            tools: {
              $splice: [ [ idx, 1 ] ],
            },
          },
        },
      });
    },
    [setGameHidden]: (state, payload) => {
      return setSafe(state, ['discovered', payload.gameId, 'hidden'], payload.hidden);
    },
    [addSearchPath]: (state, payload) => {
      return pushSafe(state, ['searchPaths'], payload);
    },
    [removeSearchPath]: (state, payload) => {
      return removeValue(state, ['searchPaths'], payload);
    },
  },
  defaults: {
    current: undefined,
    searchPaths: undefined,
    discovered: {},
  },
};
