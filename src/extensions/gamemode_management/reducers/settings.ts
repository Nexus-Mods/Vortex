import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, merge,
         pushSafe, removeValue, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/settings';

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.addDiscoveredGame as any]: (state, payload) => {
      // don't replace previously discovered tools as the settings
      // there may also be user configuration
      return merge(state, ['discovered', payload.id], payload.result);
    },
    [actions.addDiscoveredTool as any]: (state, payload) => {
      return setSafe(state,
                     ['discovered', payload.gameId, 'tools', payload.toolId],
                     payload.result);
    },
    [actions.setToolVisible as any]: (state, payload) => {
      // custom added tools can be deleted so we do that instead of hiding them
      if (!payload.visible && getSafe(state,
                  ['discovered', payload.gameId, 'tools', payload.toolId, 'custom'],
                  false)) {
        return deleteOrNop(state, ['discovered', payload.gameId, 'tools', payload.toolId]);
      } else {
        return setSafe(state,
                       ['discovered', payload.gameId, 'tools', payload.toolId, 'hidden'],
                       !payload.visible);
      }
    },
    [actions.setGameParameters as any]: (state, payload) => {
      // this is effectively the same as addDiscoveredGame but if we were adding safety
      // checks this would have other checks than addDiscoveredGame
      return merge(state, ['discovered', payload.gameId], payload.parameters);
    },
    [actions.setGameHidden as any]: (state, payload) => {
      return setSafe(state, ['discovered', payload.gameId, 'hidden'], payload.hidden);
    },
    [actions.addSearchPath as any]: (state, payload) => {
      return pushSafe(state, ['searchPaths'], payload);
    },
    [actions.removeSearchPath as any]: (state, payload) => {
      return removeValue(state, ['searchPaths'], payload);
    },
  },
  defaults: {
    searchPaths: undefined,
    discovered: {},
  },
};
