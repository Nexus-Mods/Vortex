import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.addMod]: (state, payload) => {
      const { gameId, mod } = payload;
      return setSafe(state, [gameId, mod.id], mod);
    },
    [actions.removeMod]: (state, payload) => {
      const { gameId, modId } = payload;
      return deleteOrNop(state, [gameId, modId]);
    },
    [actions.setModInstallationPath]: (state, payload) => {
      const { gameId, modId, installPath } = payload;
      return setSafe(state, [gameId, modId, 'installationPath'], installPath);
    },
    [actions.setModState]: (state, payload) => {
      const { gameId, modId, modState } = payload;
      return setSafe(state, [gameId, modId, 'state'], modState);
    },
    [actions.setModAttribute]: (state, payload) => {
      const { gameId, modId, attribute, value } = payload;
      return setSafe(state, [gameId, modId, 'attributes', attribute], value);
    },
  }, defaults: {
  },
};
