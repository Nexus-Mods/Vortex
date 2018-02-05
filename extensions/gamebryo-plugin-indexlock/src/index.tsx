import LockIndex from './LockIndex';
import { indexReducer } from './reducers';
import { IPlugin } from './types';

import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { selectors, Toggle, types, util } from 'vortex-api';

function genAttribute(api: types.IExtensionApi): types.ITableAttribute<IPlugin> {
  return {
    id: 'lockIndex',
    name: 'Lock Mod Index',
    icon: 'locked',
    customRenderer:
        (plugin: IPlugin, detail, t: I18next.TranslationFunction) => (
          <LockIndex
            plugin={plugin}
            gameMode={selectors.activeGameId(api.store.getState())}
          />
        ),
    calc: (plugin: IPlugin) => {
      const state: types.IState = api.store.getState();
      const gameMode = selectors.activeGameId(state);
      const statePath = ['persistent', 'plugins', 'lockedIndices', gameMode, plugin.name];
      return util.getSafe(state, statePath, undefined);
    },
    placement: 'detail',
    isVolatile: true,
    edit: {},
  };
}

function init(context: types.IExtensionContext) {
  context.requireExtension('gamebryo-plugin-management');
  context.registerReducer(['persistent', 'plugins', 'lockedIndices'], indexReducer);

  context.registerTableAttribute('gamebryo-plugins', genAttribute(context.api));

  context.once(() => {
    let updating: boolean = false;
    context.api.onStateChange(['loadOrder'], (oldState, newState) => {
      if (updating) {
        return;
      }
      const store: Redux.Store<any> = context.api.store;
      const gameMode = selectors.activeGameId(store.getState());
      const fixed = util.getSafe(store.getState(),
                                 ['persistent', 'plugins', 'lockedIndices', gameMode], {});
      if (Object.keys(fixed).length === 0) {
        // hopefully the default case: nothing locked
        return;
      }

      const plugins = util.getSafe(store.getState(), ['session', 'plugins', 'pluginList'], {});
      // create sorted order without any locked plugins
      const sorted = Object.keys(newState)
        .filter(key => fixed[key] === undefined)
        .sort((lhs, rhs) => newState[lhs].loadOrder - newState[rhs].loadOrder);

      // locked index -> locked plugin
      const toInsert = Object.keys(fixed).reduce((prev, key) => {
        prev[fixed[key]] = key;
        return prev;
      }, {});

      let currentModIndex: number = Object.keys(plugins).filter(
        key => plugins[key].isNative && (path.extname(key) !== '.esl')).length;
      // tslint:disable-next-line:prefer-for-of
      for (let idx = 0; idx < sorted.length; ++idx) {
        if (!newState[sorted[idx]].enabled) {
          continue;
        }
        if (path.extname(sorted[idx]) === '.esl') {
          continue;
        }

        ++currentModIndex;
        if (toInsert[currentModIndex] !== undefined) {
          sorted.splice(idx + 1, 0, toInsert[currentModIndex]);
        }
      }
      try {
        updating = true;
        // TODO: bit of a hack. We can't use the react-act action from
        //   a different extension
        store.dispatch({
          type: 'SET_PLUGIN_ORDER',
          payload: sorted,
        });
      } finally {
        updating = false;
      }
    });
  });
  return true;
}

export default init;
