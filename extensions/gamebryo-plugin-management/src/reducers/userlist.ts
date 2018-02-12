import { types, util } from 'vortex-api';

import * as actions from '../actions/userlist';

type RuleType = 'after' | 'requires' | 'incompatible';

function listForType(type: string) {
  switch (type) {
    case 'requires': return 'req';
    case 'incompatible': return 'inc';
    default: return 'after';
  }
}

function isValidPriority(input): boolean {
  return !(
    (input === null)
    || isNaN(input)
    || (input < -127)
    || (input > 127));
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
    [actions.setLocalPriority as any]: (state, payload) => {
      if (!isValidPriority(payload.priority)) {
        return state;
      }

      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      if (existing !== -1) {
        return util.setSafe(state, ['plugins', existing, 'priority'],  payload.priority);
      } else {
        return util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          priority: payload.priority,
        });
      }
    },
    [actions.setGlobalPriority as any]: (state, payload) => {
      if (!isValidPriority(payload.priority)) {
        return state;
      }

      let existing: number = -1;
      if ((state.plugins !== undefined) && !!payload.pluginId) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      if (existing !== -1) {
        return util.setSafe(state, ['plugins', existing, 'global_priority'], payload.priority);
      } else if (payload.pluginId) {
        return util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          global_priority: payload.priority,
        });
      }
    },
  },
  defaults: {
  },
};

export default userlistReducer;
