import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setPath as any]: (state, payload) => {
      const { gameId, key, path } = payload;
      return setSafe(state, ['paths', gameId, key], path);
    },
    [actions.setActivator as any]: (state, payload) => {
      const { gameId, activatorId } = payload;
      return setSafe(state, ['activator', gameId], activatorId);
    },
    [actions.setUpdatingMods as any]: (state, payload) => {
      const { gameId, updatingMods } = payload;
      return setSafe(state, ['updatingMods', gameId], updatingMods);
    },
    [actions.setShowModDropzone as any]: (state, payload) =>
      setSafe(state, ['showDropzone'], payload),
  },
  defaults: {
    paths: {},
    modlistState: {},
    activator: {},
    updatingMods: {},
    showDropzone: true,
  },
};
