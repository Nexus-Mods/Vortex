import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, pushSafe, removeValueIf, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';

import * as _ from 'lodash';
import { IRule } from 'modmeta-db';

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.addMod as any]: (state, payload) => {
      const { gameId, mod } = payload;
      if (state.gameId === undefined) {
        return state;
      }
      return setSafe(state, [gameId, mod.id], mod);
    },
    [actions.removeMod as any]: (state, payload) => {
      const { gameId, modId } = payload;
      return deleteOrNop(state, [gameId, modId]);
    },
    [actions.setModInstallationPath as any]: (state, payload) => {
      const { gameId, modId, installPath } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'installationPath'], installPath);
    },
    [actions.setModState as any]: (state, payload) => {
      const { gameId, modId, modState } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'state'], modState);
    },
    [actions.setModAttribute as any]: (state, payload) => {
      const { gameId, modId, attribute, value } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'attributes', attribute], value);
    },
    [actions.addModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      let idx = -1;
      if (['after', 'before'].indexOf(rule.type) !== -1) {
        let filteredRef = _.omitBy(rule.reference, _.isUndefined);
        idx = getSafe(state, [gameId, modId, 'rules'], [])
                  .findIndex((iterRule: IRule) => {
                    let typeMatch =
                        ['after', 'before'].indexOf(rule.type) !== -1;
                    let filteredIter = _.omitBy(iterRule.reference, _.isUndefined);
                    return typeMatch && _.isEqual(filteredRef, filteredIter);
                  });
      }
      if (idx !== -1) {
        return setSafe(state, [gameId, modId, 'rules', idx], rule);
      } else {
        return pushSafe(state, [gameId, modId, 'rules'], rule);
      }
    },
    [actions.removeModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      return removeValueIf(state, [gameId, modId, 'rules'],
        (iterRule: IRule) => _.isEqual(iterRule, rule));
    },
  }, defaults: {
  },
};
