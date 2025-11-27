import * as actions from './actions';

import { types, util } from 'vortex-api';

const persistentReducer: types.IReducerSpec = {
  reducers: {
    [actions.setGameVersion as any]: (state, payload) => {
      const { gameId, version } = payload;
      return util.setSafe(state, [ 'versions', gameId ], version);
    },
  },
  defaults: {
    versions: {},
  },
};

export default persistentReducer;
