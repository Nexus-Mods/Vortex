import { types, util } from 'nmm-api';

import * as actions from '../actions/session';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSavegames as any]: (state, payload) => {
      return util.setSafe(state, ['saves'], payload);
    },
    [actions.removeSavegame as any]: (state, payload) => {
      return util.deleteOrNop(state, ['saves', payload]);
    },
    [actions.setSavegameState as any]: (state, payload) => {
      const { id, savegameState } = payload;
      return update(state, { saves: { [id]: { state: { $set: savegameState } } } });
    },
    [actions.setSavegameAttribute as any]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, { saves: { [id]: { attributes: { [attribute]: { $set: value } } } } });
    },
    [actions.showTransferDialog as any]: (state, payload) => {
      return util.setSafe(state, ['showDialog'], payload);
    },
    [actions.clearSavegames as any]: (state, payload) => {
      return update(state, { saves: { $set: {} } });
    },
    [actions.setSavegamePath as any]: (state, payload) =>
      util.setSafe(state, ['savegamePath'], payload),
  }, defaults: {
    saves: {},
    savegamePath: '',
    showDialog: false,
    selectAllSavegames: false,
    selectedProfile: undefined,
  },
};
