import { types, util } from 'nmm-api';

import * as actions from '../actions/session';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSavegames]: (state, payload) => {
      return util.setSafe(state, ['saves'], payload);
    },
    [actions.removeSavegame]: (state, payload) => {
      return util.deleteOrNop(state, ['saves', payload]);
    },
    [actions.setSavegameState]: (state, payload) => {
      const { id, savegameState } = payload;
      return update(state, { saves: { [id]: { state: { $set: savegameState } } } });
    },
    [actions.setSavegameAttribute]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, { saves: { [id]: { attributes: { [attribute]: { $set: value } } } } });
    },
    [actions.clearSavegames]: (state, payload) => {
      return update(state, { saves: { $set: {} } });
    },
    [actions.setSavegamePath]: (state, payload) =>
      util.setSafe(state, ['savegamePath'], payload),
  }, defaults: {
    saves: {},
    savegamePath: '',
  },
};
