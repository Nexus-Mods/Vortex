import { addMod, setAttributeEnabled, setModAttribute, setModState } from '../actions/mods';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to the known mods
 */
export const modsReducer = createReducer({
  [addMod]: (state, payload) => update(state, { mods: { [payload.id]: { $set: payload } } }),
  [setModState]: (state, payload) => {
    const { id, modState } = payload;
    return update(state, { mods: { [id]: { state: { $set: modState } } } });
  },
  [setModAttribute]: (state, payload) => {
    const { id, attribute, value } = payload;
    return update(state, { mods: { [id]: { attributes: { [attribute]: { $set: value } } } } });
  },
  [setAttributeEnabled]: (state, payload) => {
    const { id, enabled } = payload;
    return update(state, { attributeState: { [id]: { enabled: { $set: enabled } } } });
  },
}, {
    attributeState: {},
    mods: {},
  }
);
