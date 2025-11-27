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
        existing = state.plugins.findIndex(plug =>
          plug.name.toUpperCase() === payload.pluginId.toUpperCase());
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        const statePath = ['plugins', existing, list];
        return (util as any).addUniqueSafe(state, statePath, payload.reference);
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
        existing = state.plugins.findIndex(plug =>
          plug.name.toUpperCase() === payload.pluginId.toUpperCase());
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        return util.removeValueIf(state, ['plugins', existing, list], ref =>
          ref.toUpperCase() === payload.reference.toUpperCase());
      } else {
        return state;
      }
    },
    [actions.addGroup as any]: (state, payload) =>
      (state.groups.find(group => group.name.toUpperCase() === payload.group.toUpperCase()) === undefined)
        ? util.pushSafe(state, ['groups'], {
          name: payload.group,
          after: [],
        })
        : state,
    [actions.removeGroup as any]: (state, payload) => {
      // need to remove the group from all rules
      state.groups.forEach((group, idx) => {
        state = util.removeValue(state, ['groups', idx, 'after'], payload.group);
      });

      state.plugins.forEach((plugin, idx) => {
        if ((plugin.group !== undefined)
            && (payload.group !== undefined)
            && (plugin.group.toUpperCase() === payload.group.toUpperCase())) {
          state = util.setSafe(state, ['plugins', idx, 'group'], 'default');
        }
      });

      return util.removeValueIf(state, ['groups'], group => group.name.toUpperCase() === payload.group.toUpperCase());
    },
    [actions.setGroup as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug =>
          plug.name.toUpperCase() === payload.pluginId.toUpperCase());
      }

      if (payload.group === undefined) {
        return (existing !== -1)
          ? util.deleteOrNop(state, ['plugins', existing, 'group'])
          : state;
      }

      return (existing !== -1)
        ? util.setSafe(state, ['plugins', existing, 'group'],  payload.group)
        : util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          group: payload.group,
        });
    },
    [actions.addGroupRule as any]: (state, payload) => {
      const idx = state.groups.findIndex(group =>
        group.name.toUpperCase() === payload.groupId.toUpperCase());
      if (idx === -1) {
        return util.pushSafe(state, ['groups'], {
          name: payload.groupId,
          after: [ payload.reference ],
        });
      } else {
        return util.addUniqueSafe(state, ['groups', idx, 'after'], payload.reference);
      }
    },
    [actions.removeGroupRule as any]: (state, payload) => {
      const idx = state.groups.findIndex(group =>
        group.name.toUpperCase() === payload.groupId.toUpperCase());
      if (idx === -1) {
        return state;
      }
      return util.removeValue(state, ['groups', idx, 'after'], payload.reference);
    },
  },
  defaults: {
  },
};

export default userlistReducer;
