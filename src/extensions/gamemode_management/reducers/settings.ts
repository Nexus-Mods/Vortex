import { IReducerSpec } from '../../../types/IExtensionContext';
import { addDiscoveredGame, setGameMode } from '../actions/settings';
import { addSearchPath, removeSearchPath } from '../actions/settings';
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
      return update(state, {
        discovered: {
          [payload.id]: { $set: payload.result },
        },
      });
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
    discovered: {},
    searchPaths: undefined,
  },
};
