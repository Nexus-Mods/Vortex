import { types, util } from 'nmm-api';

import {
  setSavegamelistAttributeSort, setSavegamelistAttributeVisible,
} from '../actions/settings';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setSavegamelistAttributeVisible]: (state, payload) => {
      const { attributeId, visible } = payload;
      return util.setSafe(state, [attributeId, 'enabled'], visible);
    },
    [setSavegamelistAttributeSort]: (state, payload) => {
      const { attributeId, direction } = payload;
      return util.setSafe(state, [attributeId, 'sortDirection'], direction);
    },
  }, defaults: {
    id: {
      enabled: false,
    },
    filename: {
      enabled: false,
    },
    creationtime: {
      sortDirection: 'asc',
    },
  },
};
