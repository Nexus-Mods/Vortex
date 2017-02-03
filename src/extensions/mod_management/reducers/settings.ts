import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setActivator, setPath } from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setPath]: (state, payload) => {
      const { gameId, key, path } = payload;
      return setSafe(state, [ 'paths', gameId, key ], path);
    },
    [setActivator]: (state, payload) => {
      const { gameId, activatorId } = payload;
      return setSafe(state, [ 'activator', gameId ], activatorId);
    },
  }, defaults: {
    paths: { },
    modlistState: { },
    activator: { },
  },
};
