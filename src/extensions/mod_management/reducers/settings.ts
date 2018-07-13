import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setInstallPath as any]: (state, payload) => {
      const { gameId, path } = payload;
      return setSafe(state, ['installPath', gameId], path);
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
    [actions.setConfirmPurge as any]: (state, payload) =>
      setSafe(state, ['confirmPurge'], payload),
  },
  defaults: {
    installPath: {},
    modlistState: {},
    activator: {},
    updatingMods: {},
    showDropzone: true,
    confirmPurge: true,
  },
};
