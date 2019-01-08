import { types, util } from 'vortex-api';

import * as actions from './actions';

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setGists as any]: (state, payload) =>
      util.setSafe(state, ['gists'], payload),
  },
  defaults: {
    gists: [],
  },
};

export default sessionReducer;
