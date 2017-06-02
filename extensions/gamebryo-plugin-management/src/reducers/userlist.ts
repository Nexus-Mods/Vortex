import { types, util } from 'nmm-api';

import * as actions from '../actions/userlist';

type RuleType = 'after' | 'requires' | 'incompatible';

function listForType(type: string) {
  switch (type) {
    case 'requires': return 'req';
    case 'incompatible': return 'inc';
    default: return 'after';
  }
}

/**
 * reducer for changes to settings regarding mods
 */
const userlistReducer: types.IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.hasOwnProperty('userlist')) {
        return util.setSafe(state, [], payload.userlist);
      } else {
        return state;
      }
    },
    [actions.addRule as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        return util.pushSafe(state, ['plugins', existing, list], payload.reference);
      } else {
        const res = util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          [list]: [ payload.reference ],
        });
        return res;
      }
    },
    [actions.removeRule as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        return util.removeValue(state, ['plugins', existing, list], payload.reference);
      } else {
        return state;
      }
    },
  },
  defaults: {
  },
};

export default userlistReducer;
