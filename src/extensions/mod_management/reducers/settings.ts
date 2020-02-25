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
    [actions.setShowModDropzone as any]: (state, payload) =>
      setSafe(state, ['showDropzone'], payload),
    [actions.setConfirmPurge as any]: (state, payload) =>
      setSafe(state, ['confirmPurge'], payload),
    [actions.setCleanupOnDeploy as any]: (state, payload) =>
      setSafe(state, ['cleanupOnDeploy'], payload),
  },
  defaults: {
    installPath: {},
    modlistState: {},
    activator: {},
    showDropzone: true,
    confirmPurge: true,
    cleanupOnDeploy: false,
  },
  verifiers: {
    installPath: {
      // shouldn't be possible
      description: () => 'Severe! Invalid set of staging folders',
      elements: {
        _: {
          description: () => 'Severe! A mod staging folder was corrupted and has to be reset',
          type: 'string',
        },
      },
    },
  },
};
