import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, pushSafe, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.addMod as any]: (state, payload) => {
      const { gameId, mod } = payload;
      return setSafe(state, [gameId, mod.id], mod);
    },
    [actions.removeMod as any]: (state, payload) => {
      const { gameId, modId } = payload;
      return deleteOrNop(state, [gameId, modId]);
    },
    [actions.setModInstallationPath as any]: (state, payload) => {
      const { gameId, modId, installPath } = payload;
      return setSafe(state, [gameId, modId, 'installationPath'], installPath);
    },
    [actions.setModState as any]: (state, payload) => {
      const { gameId, modId, modState } = payload;
      return setSafe(state, [gameId, modId, 'state'], modState);
    },
    [actions.setModAttribute as any]: (state, payload) => {
      const { gameId, modId, attribute, value } = payload;
      return setSafe(state, [gameId, modId, 'attributes', attribute], value);
    },
    [actions.addModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      return pushSafe(state, [gameId, modId, 'rules'], rule);
    }
  }, defaults: {
  },
};
