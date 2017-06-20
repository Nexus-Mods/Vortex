import { types, util } from 'nmm-api';

import * as actions from './actions';

const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.selectTheme as any]: (state, payload) =>
      util.setSafe(state, ['currentTheme'], payload),
  },
  defaults: {
    currentTheme: 'default',
  },
};

export default settingsReducer;

