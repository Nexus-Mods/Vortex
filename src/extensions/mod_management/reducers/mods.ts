import { IReducerSpec } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import {removeValue} from '../../../util/storeHelper';
import { deleteOrNop, getSafe,
  merge, pushSafe, removeValueIf, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';
import {IMod} from '../types/IMod';
import { referenceEqual } from '../util/testModReference';

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
    [actions.setModArchiveId as any]: (state, payload) => {
      const { gameId, modId, archiveId } = payload;
      return setSafe(state, [gameId, modId, 'archiveId'], archiveId);
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
    [actions.setModAttributes as any]: (state, payload) => {
      const { gameId, modId, attributes } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      return merge(state, [gameId, modId, 'attributes'], attributes);
    },
    [actions.setModType as any]: (state, payload) => {
      const { gameId, modId, type } = payload;
      if (getSafe(state, [gameId, modId], undefined) === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'type'], type);
    },
    [actions.clearModRules as any]: (state, payload) => {
      const { gameId, modId } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        return state;
      }
      return setSafe(state, [gameId, modId, 'rules'], []);
    },
    [actions.addModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      if ((state[gameId] === undefined) || (state[gameId][modId] === undefined)) {
        log('warn', 'tried to add mod rule to mod that isn\'t installed', { gameId, modId });
        return state;
      }
      const filteredRef = _.omitBy(rule.reference, _.isUndefined);
      let idx = -1;

      // mutually exclusive types replace each other, so if we add a "before"
      // rule we first remove any existing "after" rule with the same reference
      const typeGroups = [
        ['after', 'before'],
        ['requires', 'recommends'],
      ];
      let group = typeGroups.find(grp => grp.indexOf(rule.type) !== -1);
      if (group === undefined) {
        group = [rule.type];
      }

      idx = getSafe(state, [gameId, modId, 'rules'], [])
        .findIndex((iterRule: IRule) => {
          const typeMatch = group.indexOf(rule.type) !== -1;
          const filteredIter = _.omitBy(iterRule.reference, _.isUndefined);
          return typeMatch && referenceEqual(filteredRef, filteredIter);
        });

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
    [actions.setFileOverride as any]: (state, payload) => {
      const { gameId, modId, files }  = payload;
      return setSafe(state, [gameId, modId, 'fileOverrides'], files);
    },
  },
  defaults: {
  },
  verifiers: {
    _: {
      // shouldn't be possible
      description: () => 'Severe! Corrupted mod list',
      elements: {
        _: {
          type: 'object',
          description: () => 'Corrupted mod info will be reset',
          deleteBroken: true,
          elements: {
            installationPath: {
              type: 'string',
              description: () => 'Mod with invalid attribute will be reset.',
              noUndefined: true,
              noNull: true,
              noEmpty: true,
              required: true,
              deleteBroken: 'parent',
            },
            attributes: {
              type: 'object',
              description: () => '',
              elements: {
                newestChangelog: {
                  type: 'object',
                  description: () => 'Corrupted mod changelog will be reset',
                  deleteBroken: true,
                },
              },
            },
          },
        },
      },
    },
  },
};
