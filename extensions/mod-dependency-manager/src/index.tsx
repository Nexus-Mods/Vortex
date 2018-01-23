/**
 * Extension for editing and visualising mod dependencies
 */

import { IBiDirRule } from './types/IBiDirRule';
import { IConflict } from './types/IConflict';
import { IModLookupInfo } from './types/IModLookupInfo';
import determineConflicts from './util/conflicts';
import matchReference from './util/matchReference';
import renderModLookup from './util/renderModLookup';
import renderModName from './util/renderModName';
import renderReference from './util/renderReference';
import ruleFulfilled from './util/ruleFulfilled';
import ConflictEditor from './views/ConflictEditor';
import Connector from './views/Connector';
import DependencyIcon, { ILocalState } from './views/DependencyIcon';
import Editor from './views/Editor';
import ProgressFooter from './views/ProgressFooter';

import { highlightConflictIcon, setConflictInfo } from './actions';
import connectionReducer from './reducers';
import { enabledModKeys } from './selectors';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import { ILookupResult, IModInfo, IReference, IRule, RuleType } from 'modmeta-db';
import * as path from 'path';
import * as React from 'react';
import * as Redux from 'redux';
import {} from 'redux-thunk';
import { actions, ComponentEx, log, selectors, types, util } from 'vortex-api';

function makeReference(mod: IModInfo): IReference {
  return {
    fileExpression: mod.fileName,
    fileMD5: mod.fileMD5,
    versionMatch: mod.fileVersion,
    logicalFileName: mod.logicalFileName,
  };
}

function makeModReference(mod: types.IMod): IReference {
  if ((mod.attributes['fileMD5'] === undefined)
      && (mod.attributes['logicalFileName'] === undefined)
      && (mod.attributes['fileName'] === undefined)) {
    // if none of the usual markers are available, use just the mod name
    return {
      fileExpression: mod.attributes['name'],
    };
  }

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
    const ref = makeModReference(mod);
    if ((ref.fileExpression === undefined)
       && (ref.fileMD5 === undefined)
       && (ref.logicalFileName === undefined)) {
      return;
    }
    rules = rules.concat(mapRules(ref, mod.rules));
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

const dependencyState = util.makeReactive<ILocalState>({
  modRules: [],
});

interface ILoadOrderState {
  [id: string]: number;
}

let loadOrder: ILoadOrderState = {};

function findRule(ref: IModLookupInfo): IBiDirRule {
  return dependencyState.modRules.find(rule => {
    return matchReference(rule.reference, ref);
  });
}

function updateConflictInfo(api: types.IExtensionApi,
                            conflicts: { [modId: string]: IConflict[] }) {
  const t: I18next.TranslationFunction = api.translate;
  const store: Redux.Store<types.IState> = api.store;

  const gameMode: string = selectors.activeGameId(store.getState());
  const mods = store.getState().persistent.mods[gameMode];
  const unsolved: { [modId: string]: IConflict[] } = {};

  const encountered = new Set<string>();

  const mapEnc = (lhs: string, rhs: string) => [lhs, rhs].sort().join(':');

  // see if there is a mod that has conflicts for which there are no rules
  Object.keys(conflicts).forEach(modId => {
    const filtered = conflicts[modId].filter(conflict =>
      (findRule(conflict.otherMod) === undefined)
      && !encountered.has(mapEnc(modId, conflict.otherMod.id)));

    if (filtered.length !== 0) {
      unsolved[modId] = filtered;
      filtered.forEach(conflict => {
        encountered.add(mapEnc(modId, conflict.otherMod.id));
      });
    }
  });

  if (Object.keys(unsolved).length === 0) {
    store.dispatch(actions.dismissNotification('mod-file-conflict'));
  } else {
    const message: string[] = [
      t('There are unsolved file conflicts. Such conflicts are not necessarily '
        + 'a problem but you should set up a rule to decide the priorities between '
        + 'these mods, otherwise it will be random (not really but it might as well be).\n'),
      '[table][tbody]',
    ].concat(Object.keys(unsolved).map(modId =>
      '[tr]' + t('[td]{{modName}}[/td]'
                + '[td][color="red"][svg]flash[/svg][/color][/td]'
                + '[td][list]{{conflicts}}[/list][/td][/tr]', {
          replace: {
            modName: renderModName(mods[modId]),
            conflicts: unsolved[modId].map(
              conflict => '[*] ' + renderModLookup(conflict.otherMod)),
      }})), '[/tbody][/table]');
    const showDetails = () => {
      store.dispatch(actions.showDialog(
        'info',
        t('Unsolved file conflicts'), {
          bbcode: message.join('\n'),
          options: { translated: true, wrap: true },
        }, [
          { label: 'Close' },
          { label: 'Show', action: () => {
            store.dispatch(actions.setAttributeVisible('mods', 'dependencies', true));
            api.events.emit('show-main-page', 'Mods');
            setTimeout(() => {
              store.dispatch(highlightConflictIcon(true));
              api.events.emit('mods-scroll-to', Object.keys(unsolved)[0]);
            }, 1000);
            setTimeout(() => {
              store.dispatch(highlightConflictIcon(false));
            }, 3000);
          } },
      ]));
    };

    store.dispatch(actions.addNotification({
      type: 'warning',
      message: 'There are unsolved file conflicts',
      id: 'mod-file-conflict',
      noDismiss: true,
      actions: [{
        title: 'More',
        action: showDetails,
      }],
    }));
  }
}

function renderRuleType(t: I18next.TranslationFunction, type: RuleType): string {
  switch (type) {
    case 'conflicts': return t('conflicts with');
    case 'requires': return t('requires');
    default: return 'unknown';
  }
}

function checkRulesFulfilled(api: types.IExtensionApi): Promise<void> {
  const t = api.translate;
  const store = api.store;
  const state = store.getState();
  const enabledMods: IModLookupInfo[] = enabledModKeys(state);
  const gameMode = selectors.activeGameId(state);
  const mods = state.persistent.mods[gameMode];

  return Promise.map(enabledMods, modLookup => {
    const mod: types.IMod = mods[modLookup.id];

    return api.lookupModMeta({
      fileMD5: mod.attributes['fileMD5'],
      fileSize: mod.attributes['fileSize'],
      gameId: gameMode,
    })
      .then((meta: ILookupResult[]) => {
        const rules: IRule[] = [].concat(
          meta.length > 0 ? meta[0].value.rules || [] : [],
          util.getSafe(mods[modLookup.id], ['rules'], []),
        );
        const rulesUnfulfilled = rules.filter(rule => ruleFulfilled(enabledMods, rule) === false);
        const res: { modId: string, rules: IRule[] } = rulesUnfulfilled.length === 0
          ? null : {
            modId: mod.id,
            rules: rulesUnfulfilled,
          };
        return Promise.resolve(res);
      });
  })
    .then((unfulfilled: Array<{ modId: string, rules: IRule[] }>) => {
      const modsUnfulfilled = unfulfilled.filter(iter => iter !== null);

      if (modsUnfulfilled.length === 0) {
        store.dispatch(actions.dismissNotification('mod-rule-unfulfilled'));
      } else {
        const message: string[] = [
          t('There are mod dependency rules that aren\'t fulfilled.'),
        ].concat(modsUnfulfilled.map(iter =>
          iter.rules.map(rule => {
            const modName = renderModName(mods[iter.modId]);
            const type = renderRuleType(t, rule.type);
            const other = renderReference(rule.reference);
            return `${modName} ${type} ${other}`;
          }).join('\n')));
        const showDetails = () => {
          store.dispatch(actions.showDialog(
            'info',
            t('Unsolved file conflicts'), {
              message: message.join('\n'),
              options: { translated: true, wrap: true },
            }, [ { label: 'Close' } ]));
        };

        store.dispatch(actions.addNotification({
          type: 'warning',
          message: 'Some mod dependencies are not fulfilled',
          id: 'mod-rule-unfulfilled',
          noDismiss: true,
          actions: [{
            title: 'More',
            action: showDetails,
          }],
        }));
      }
    });
}

function checkConflictsAndRules(api: types.IExtensionApi): Promise<void> {
  const store = api.store;
  const state = store.getState();
  const modPath = selectors.installPath(state);
  const gameId = selectors.activeGameId(state);
  if (gameId === undefined) {
    return Promise.resolve();
  }
  const modState = selectors.activeProfile(state).modState;
  const mods = Object.keys(state.persistent.mods[gameId] || {})
    .filter(modId => util.getSafe(modState, [modId, 'enabled'], false))
    .map(modId => state.persistent.mods[gameId][modId]);
  store.dispatch(actions.startActivity('mods', 'conflicts'));
  return determineConflicts(modPath, mods)
    .then(conflictMap => {
      store.dispatch(setConflictInfo(conflictMap));
      updateConflictInfo(api, conflictMap);
      return checkRulesFulfilled(api);
    })
    .finally(() => {
      store.dispatch(actions.stopActivity('mods', 'conflicts'));
    });
}

function generateLoadOrder(api: types.IExtensionApi): Promise<void> {
  const store = api.store;
  const gameMode = selectors.activeGameId(store.getState());
  const state: types.IState = store.getState();
  const gameMods = state.persistent.mods[gameMode] || [];
  const mods = Object.keys(gameMods).map(key => gameMods[key]);
  return util.sortMods(gameMode, mods, api)
  .then(sortedMods => {
    loadOrder = sortedMods.reduce(
      (prev: { [id: string]: number }, modId: string, idx: number) => {
        prev[modId] = idx;
        return prev;
      }, {});
  });
}

function main(context: types.IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'loadOrder',
    name: 'Install Order',
    description: 'Install order derived from mod dependencies',
    icon: 'order',
    placement: 'table',
    isToggleable: true,
    isSortable: true,
    isDefaultVisible: false,
    calc: (mod: types.IMod) => loadOrder[mod.id],
    edit: {},
    isVolatile: true,
  });

  context.registerTableAttribute('mods', {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Relations to other mods',
    icon: 'plug',
    placement: 'table',
    customRenderer: (mod, detailCell, t, props) => (
      <DependencyIcon
        mod={mod}
        t={t}
        localState={dependencyState}
        onHighlight={props.onHighlight}
      />
    ),
    calc: (mod: types.IMod) =>
      dependencyState.modRules.filter(rule => matchReference(rule.source, mod)),
    isToggleable: true,
    isDefaultVisible: false,
    edit: {},
    isSortable: false,
    isVolatile: true,
  });

  context.registerReducer(['session', 'dependencies'], connectionReducer);
  context.registerDialog('mod-dependencies-connector', Connector);
  context.registerDialog('mod-dependencies-editor', Editor);
  context.registerDialog('mod-conflict-editor', ConflictEditor);

  context.once(() => {
    const store = context.api.store;

    context.api.setStylesheet('dependency-manager',
                              path.join(__dirname, 'dependency-manager.scss'));

    context.api.events.on('profile-did-change', () => {
      const gameMode = selectors.activeGameId(store.getState());
      updateMetaRules(context.api, gameMode, store.getState().persistent.mods[gameMode])
      .then(rules => {
        dependencyState.modRules = rules;
        updateConflictTimer.schedule(undefined);
      });
    });

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state: types.IState = store.getState();
      generateLoadOrder(context.api)
        .then(() => updateMetaRules(context.api, gameMode, state.persistent.mods[gameMode]))
        .then(rules => {
          dependencyState.modRules = rules;
          return null;
        });
    });

    context.api.onStateChange(['persistent', 'mods'], (oldState, newState) => {
      const gameMode = selectors.activeGameId(store.getState());
      if (oldState[gameMode] !== newState[gameMode]) {
        generateLoadOrder(context.api)
          .then(() => updateMetaRules(context.api, gameMode, newState[gameMode]))
          .then(rules => {
            dependencyState.modRules = rules;
            updateConflictTimer.schedule(undefined);
            return null;
          });
      }
    });

    const updateConflictTimer = new util.Debouncer(() =>
      checkConflictsAndRules(context.api), 2000);

    context.api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
      updateConflictTimer.schedule(undefined);
    });
  });

  return true;
}

export default main;
