import { IReducerSpec } from '../../../types/IExtensionContext';

import { addMod, clearMods, setModAttribute, setModState } from '../actions/mods';

import update = require('react-addons-update');

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [addMod]: (state, payload) => update(state, { mods: { [payload.id]: { $set: payload } } }),
    [clearMods]: (state, payload) => update(state, { mods: { $set: {} } } ),
    [setModState]: (state, payload) => {
      const { id, modState } = payload;
      return update(state, { mods: { [id]: { state: { $set: modState } } } });
    },
    [setModAttribute]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, { mods: { [id]: { attributes: { [attribute]: { $set: value } } } } });
    },
  }, defaults: {
    mods: {},
  },
};
