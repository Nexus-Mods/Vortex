import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';

import update = require('react-addons-update');

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.mods !== undefined) {
        return update(state, {mods: {$set: payload.mods.mods || {}}});
      } else {
        return state;
      }
    },
    [actions.addMod]: (state, payload) => setSafe(state, ['mods', payload.id], payload),
    [actions.removeMod]: (state, payload) => deleteOrNop(state, ['mods', payload]),
    [actions.clearMods]: (state, payload) => update(state, { mods: { $set: {} } } ),
    [actions.setModInstallationPath]: (state, payload) => {
      return setSafe(state, ['mods', payload.id, 'installationPath'], payload.installPath);
    },
    [actions.setModState]: (state, payload) => {
      const { id, modState } = payload;
      return update(state, { mods: { [id]: { state: { $set: modState } } } });
    },
    [actions.setModAttribute]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, { mods: { [id]: { attributes: { [attribute]: { $set: value } } } } });
    },
  }, defaults: {
    mods: {},
  },
};
