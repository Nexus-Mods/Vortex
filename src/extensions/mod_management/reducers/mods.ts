import { IReducerSpec } from '../../../types/IExtensionContext';
import {removeValue} from '../../../util/storeHelper';
import { deleteOrNop, getSafe,
  merge, pushSafe, removeValueIf, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';
import {IMod} from '../types/IMod';

import * as _ from 'lodash';
import { IRule } from 'modmeta-db';

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.addMod as any]: (state, payload) => {
      const { gameId, mod } = payload;
      return setSafe(state, [gameId, mod.id], mod);
    },
    [actions.addMods as any]: (state, payload) => {
      const { gameId, mods } = payload;
      const modDict = mods.reduce((prev: { [key: string]: IMod }, value: IMod) => {
        prev[value.id] = value;
        return prev;
      }, {});
      return merge(state, [gameId], modDict);
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
    [actions.setModType as any]: (state, payload) => {
      const { gameId, modId, type } = payload;
      if (getSafe(state, [gameId, modId], undefined) === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'type'], type);
    },
    [actions.addModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      const filteredRef = _.omitBy(rule.reference, _.isUndefined);
      let idx = -1;
      if (['after', 'before'].indexOf(rule.type) !== -1) {
        idx = getSafe(state, [gameId, modId, 'rules'], [])
                  .findIndex((iterRule: IRule) => {
                    const typeMatch =
                        ['after', 'before'].indexOf(rule.type) !== -1;
                    const filteredIter = _.omitBy(iterRule.reference, _.isUndefined);
                    return typeMatch && _.isEqual(filteredRef, filteredIter);
                  });
      } else {
        idx = getSafe(state, [gameId, modId, 'rules'], [])
          .findIndex(iterRule => {
            const filteredIter = _.omitBy(iterRule.reference, _.isUndefined);
            return _.isEqual(filteredRef, filteredIter);
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
    [actions.setINITweakEnabled as any]: (state, payload) => {
      const { gameId, modId, tweak, enabled } = payload;
      return (enabled)
        ? pushSafe(state, [gameId, modId, 'enabledINITweaks'], tweak)
        : removeValue(state, [gameId, modId, 'enabledINITweaks'], tweak);
    },
  },
  defaults: {
  },
};
