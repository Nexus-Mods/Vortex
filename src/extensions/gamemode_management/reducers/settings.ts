import { IReducerSpec } from '../../../types/IExtensionContext';
import { addDiscoveredGame, addDiscoveredTool, setGameMode } from '../actions/settings';
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
      if (state.discovered[payload.id] !== undefined) {
        payload.result = Object.assign({}, state.discovered[payload.id], payload.result);
      }

      return update(state, {
        discovered: {
          [payload.id]: { $set: payload.result },
        },
      });
    },
    [addDiscoveredTool]: (state, payload) => {
      return update(state, {
        discovered: {
          [payload.gameId]: {
            tools: {
              [payload.toolId]: { $set: payload.result },
            },
          },
        },
      });
    },
    [setGameHidden]: (state, payload) => {
      if (!(payload.gameId in state.discovered)) {
        return update(state, {
          discovered: {
            [payload.gameId]: { $set: {
              hidden: payload.hidden,
            } },
          },
        });
      } else {
        return update(state, {
          discovered: {
            [payload.gameId]: {
              hidden: { $set: payload.hidden },
            },
          },
        });
      }
    },
    [addSearchPath]: (state, payload) => {
      if (state.searchPaths === undefined) {
        state = update(state, {
          searchPaths: { $set: [] },
        });
      }
      return update(state, {
        searchPaths: { $push: [ payload ] },
      });
    },
    [removeSearchPath]: (state, payload) => {
      const idx = state.searchPaths.indexOf(payload);
      return update(state, {
        searchPaths: { $splice: [ [ idx, 1 ] ] },
      });
    },
  },
  defaults: {
    current: undefined,
    searchPaths: undefined,
    discovered: {},
  },
};
