import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setActivator, setPath, setUpdatingMods } from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setPath as any]: (state, payload) => {
      const { gameId, key, path } = payload;
      return setSafe(state, [ 'paths', gameId, key ], path);
    },
    [setActivator as any]: (state, payload) => {
      const { gameId, activatorId } = payload;
      return setSafe(state, [ 'activator', gameId ], activatorId);
    },
    [setUpdatingMods as any]: (state, payload) => {
      const { gameId, updatingMods } = payload;
      return setSafe(state, [ 'updatingMods', gameId ], updatingMods);
    },
  }, defaults: {
    paths: { },
    modlistState: { },
    activator: { },
    updatingMods: false,
  },
};
