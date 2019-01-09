import { types, util } from 'vortex-api';

import * as actions from './actions';

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setAnnouncements as any]: (state, payload) =>
      util.setSafe(state, ['announcements'], payload),
  },
  defaults: {
    announcements: [],
  },
};

export default sessionReducer;
