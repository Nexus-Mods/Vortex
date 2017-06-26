/**
 * Extension for editing and visualising mod dependencies
 */

import { IBiDirRule } from './types/IBiDirRule';
import determineConflicts from './util/conflicts';
import ConflictEditor from './views/ConflictEditor';
import Connector from './views/Connector';
import DependencyIcon, { ILocalState } from './views/DependencyIcon';
import Editor from './views/Editor';
import ProgressFooter from './views/ProgressFooter';

import { setConflictInfo } from './actions';
import connectionReducer from './reducers';

import * as Promise from 'bluebird';
import { ILookupResult, IModInfo, IReference, IRule, RuleType } from 'modmeta-db';
import { actions, log, selectors, types, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';

function makeReference(mod: IModInfo): IReference {
  return {
    fileExpression: mod.fileName,
    fileMD5: mod.fileMD5,
    versionMatch: mod.fileVersion,
    logicalFileName: mod.logicalFileName,
  };
}

function makeModReference(mod: types.IMod): IReference {
  return {
    fileExpression: mod.attributes['fileName'],
    fileMD5: mod.attributes['fileMD5'],
    versionMatch: mod.attributes['version'],
    logicalFileName: mod.attributes['logicalFileName'],
  };
}

function inverseRule(ruleType: RuleType): RuleType {
  switch (ruleType) {
    case 'before': return 'after';
    case 'after': return 'before';
    case 'conflicts': return 'conflicts';
    default: throw new Error('unsupported rule ' + ruleType);
  }
}

function mapRules(source: IReference, rules: IRule[]): IBiDirRule[] {
  const res: IBiDirRule[] = [];
  if (rules === undefined) {
    return res;
  }
  rules.forEach(rule => {
    if (['requires', 'recommends', 'provides'].indexOf(rule.type) !== -1) {
      return;
    }
    res.push({
      source,
      type: rule.type,
      reference: rule.reference,
      original: true,
    });
    res.push({
      source: rule.reference,
      type: inverseRule(rule.type),
      reference: source,
      original: false,
    });
  });
  return res;
}

function updateMetaRules(api: types.IExtensionApi,
                         gameId: string,
                         mods: { [modId: string]: types.IMod }): Promise<IBiDirRule[]> {
  let rules: IBiDirRule[] = [];
  return Promise.map(Object.keys(mods || {}), modId => {
    const mod = mods[modId];
    rules = rules.concat(mapRules(makeModReference(mod), mod.rules));
    return api.lookupModMeta({
      fileMD5: mod.attributes['fileMD5'],
      fileSize: mod.attributes['fileSize'],
      gameId,
    })
      .then((meta: ILookupResult[]) => {
        if (meta.length > 0) {
          rules = rules.concat(mapRules(makeReference(meta[0].value), meta[0].value.rules));
        }
      })
      .catch((err: Error) => {
        log('warn', 'failed to look up mod', { err: err.message, stack: err.stack });
      });
  })
  .then(() => rules);
}

const localState = util.makeReactive<ILocalState>({
  modRules: [],
});

function main(context: types.IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Relations to other mods',
    icon: 'plug',
    placement: 'table',
    customRenderer: (mod, detailCell, t) =>
      <DependencyIcon mod={mod} t={t} localState={localState} />,
    calc: (mod) => null,
    isToggleable: true,
    isDefaultVisible: false,
    edit: {},
    isSortable: false,
  });

  context.registerReducer(['session', 'dependencies'], connectionReducer);
  context.registerDialog('mod-dependencies-connector', Connector);
  context.registerDialog('mod-dependencies-editor', Editor);
  context.registerDialog('mod-conflict-editor', ConflictEditor);
  context.registerFooter('conflict-progress', ProgressFooter);

  context.once(() => {
    const store = context.api.store;

    context.api.setStylesheet('dependency-manager',
                              path.join(__dirname, 'dependency-manager.scss'));

    context.api.events.on('profile-activated', () => {
      const state: types.IState = store.getState();
      const modPath = selectors.installPath(state);
      const gameId = selectors.activeGameId(state);
      const modState = selectors.activeProfile(state).modState;
      const mods = Object.keys(state.persistent.mods[gameId] || {})
        .filter(modId => util.getSafe(modState, [modId, 'enabled'], false))
        .map(modId => state.persistent.mods[gameId][modId]);
      store.dispatch(actions.startActivity('mods', 'conflicts'));
      determineConflicts(modPath, mods)
        .then(conflictMap => {
          store.dispatch(setConflictInfo(conflictMap));
        })
        .finally(() => {
          store.dispatch(actions.stopActivity('mods', 'conflicts'));
        });
    });

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state: types.IState = store.getState();
      updateMetaRules(context.api, gameMode, state.persistent.mods[gameMode])
        .then(rules => {
          localState.modRules = rules;
        });
    });

    context.api.onStateChange(['persistent', 'mods'], (oldState, newState) => {
      const gameMode = selectors.activeGameId(store.getState());
      if (oldState[gameMode] !== newState[gameMode]) {
        updateMetaRules(context.api, gameMode, newState[gameMode])
          .then(rules => {
            localState.modRules = rules;
          });
      }
    });
  });

  return true;
}

export default main;
