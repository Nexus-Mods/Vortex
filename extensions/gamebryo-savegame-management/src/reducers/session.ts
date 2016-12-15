import { types, util } from 'nmm-api';

import {
  addSavegame, clearSavegames, removeSavegame,
  setSavegameAttribute,
  setSavegameState,
} from '../actions/session';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [addSavegame]: (state, payload) => {
      return util.setSafe(state, ['saves', payload.id], payload);
    },
    [removeSavegame]: (state, payload) => {
      return util.deleteOrNop(state, ['saves', payload]);
    },
    [setSavegameState]: (state, payload) => {
      const { id, savegameState } = payload;
      return update(state, { saves: { [id]: { state: { $set: savegameState } } } });
    },
    [setSavegameAttribute]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, { saves: { [id]: { attributes: { [attribute]: { $set: value } } } } });
    },
    [clearSavegames]: (state, payload) => {
      return update(state, { saves: { $set: {} } });
    },
  }, defaults: {
    saves: {},
  },
};
