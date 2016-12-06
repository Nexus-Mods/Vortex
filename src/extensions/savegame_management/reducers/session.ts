import { IReducerSpec } from '../../../types/IExtensionContext';

import {
  addSavegame, clearSavegames, removeSavegame,
  setSavegameAttribute,
  setSavegameState, setSavegamelistAttributeSort, setSavegamelistAttributeVisible,
} from '../actions/session';

import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.saves !== undefined) {
        return update(state, { saves: { $set: payload.saves || {} } });
      } else {
        return state;
      }
    },
    [addSavegame]: (state, payload) => {
      return setSafe(state, ['saves', payload.id], payload);
    },
    [removeSavegame]: (state, payload) => {
      return deleteOrNop(state, ['saves', payload]);
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
    [setSavegamelistAttributeVisible]: (state, payload) => {
      return setSafe(state, ['savegamelistState',
        payload.attributeId, 'enabled'], payload.visible);
    },
    [setSavegamelistAttributeSort]: (state, payload) => {
      const { attributeId, direction } = payload;
      return setSafe(state, ['savegamelistState', attributeId, 'sortDirection'], direction);
    },
  }, defaults: {
    saves: {},
    savegamelistState: {},
  },
};
