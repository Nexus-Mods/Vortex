import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setActivator, setInstallPath, setUpdatingMods } from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setInstallPath as any]: (state, payload) => {
      const { gameId, path } = payload;
      return setSafe(state, ['installPath', gameId], path);
    },
    [setActivator as any]: (state, payload) => {
      const { gameId, activatorId } = payload;
      return setSafe(state, ['activator', gameId], activatorId);
    },
    [setUpdatingMods as any]: (state, payload) => {
      const { gameId, updatingMods } = payload;
      return setSafe(state, ['updatingMods', gameId], updatingMods);
    },
  },
  defaults: {
    installPath: {},
    modlistState: {},
    activator: {},
    updatingMods: {},
  },
};
