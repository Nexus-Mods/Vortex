import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, merge,
         pushSafe, removeValue, setOrNop, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/settings';

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.addDiscoveredGame as any]: (state, payload) =>
      // don't replace previously discovered tools as the settings
      // there may also be user configuration
      merge(state, ['discovered', payload.id], payload.result),
    [actions.setGamePath as any]: (state, payload) =>
      setOrNop(state, ['discovered', payload.gameId, 'path'], payload.gamePath),
    [actions.addDiscoveredTool as any]: (state, payload) =>
      (state.discovered[payload.gameId] === undefined)
        ? state
        : setSafe(state, ['discovered', payload.gameId, 'tools', payload.toolId], payload.result),
    [actions.setToolVisible as any]: (state, payload) =>
      // custom added tools can be deleted so we do that instead of hiding them
      (!payload.visible
       && getSafe(state, ['discovered', payload.gameId, 'tools', payload.toolId, 'custom'], false))
        ? deleteOrNop(state, ['discovered', payload.gameId, 'tools', payload.toolId])
        : setSafe(state, ['discovered', payload.gameId, 'tools', payload.toolId, 'hidden'],
                  !payload.visible),
    [actions.setGameParameters as any]: (state, payload) =>
      (state.discovered[payload.gameId] === undefined)
        ? state
        : merge(state, ['discovered', payload.gameId], payload.parameters),
    [actions.setGameHidden as any]: (state, payload) =>
      setSafe(state, ['discovered', payload.gameId, 'hidden'], payload.hidden),
    [actions.addSearchPath as any]: (state, payload) =>
      ((state.searchPaths !== undefined) && (state.searchPaths.indexOf(payload) !== -1))
        ? state
        : pushSafe(state, ['searchPaths'], payload),
    [actions.removeSearchPath as any]: (state, payload) =>
      removeValue(state, ['searchPaths'], payload),
    [actions.setPickerLayout as any]: (state, payload) =>
      setSafe(state, ['pickerLayout'], payload.layout),
  },
  defaults: {
    searchPaths: undefined,
    discovered: {},
    pickerLayout: 'small',
  },
};
