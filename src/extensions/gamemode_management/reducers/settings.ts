import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, merge,
         pushSafe, removeValue, setOrNop, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/settings';

import * as _ from 'lodash';

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.addDiscoveredGame as any]: (state, payload) => {
      // don't replace previously discovered games as the settings
      // there may also be user configuration
      const gamePath = ['discovered', payload.id];
      const res = merge(state, gamePath, payload.result);
      const merged = getSafe(res, gamePath, undefined);
      if (merged.executable === undefined) {
        // work around a problem where a value of undefined will be picked up as a
        // difference to the value not being set at all which triggered a change to be detected
        // every startup
        delete merged.executable;
      }
      // avoid triggerring unnecessary events
      if (_.isEqual(getSafe(res, gamePath, undefined), getSafe(state, gamePath, undefined))) {
        return state;
      } else {
        return res;
      }
    },
    [actions.setGamePath as any]: (state, payload) =>
      setOrNop(
        setOrNop(state, ['discovered', payload.gameId, 'path'], payload.gamePath),
        ['discovered', payload.gameId, 'pathSetManually'], payload.gamePath !== undefined),
    [actions.addDiscoveredTool as any]: (state, payload) => {
      if (state.discovered[payload.gameId] === undefined) {
        return state;
      }

      const toolPath = ['discovered', payload.gameId, 'tools', payload.toolId];

      // executable is a function. this shouldn't have been included in the first place but it's
      // easier to fix here
      // delete payload.result.executable;

      if (!payload.manual) {
        const old = _.omit(getSafe(state, toolPath, undefined), ['timestamp']);

        if (_.isEqual(old, payload.result)) {
          return state;
        }
      }

      return setSafe(state, toolPath, { ...payload.result, timestamp: Date.now() });
    },
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
    [actions.setGameSearchPaths as any]: (state, payload) =>
      setSafe(state, ['searchPaths'], payload),
    [actions.setPickerLayout as any]: (state, payload) =>
      setSafe(state, ['pickerLayout'], payload.layout),
  },
  defaults: {
    discovered: {},
    searchPaths: [],
    pickerLayout: 'small',
  },
};
