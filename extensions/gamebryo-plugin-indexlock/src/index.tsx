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
    help: api.translate('Use this to directly control the mod index of a plugin.\n'
      + 'This will completely override the order generated automatically and is '
      + 'only intended as a temporary measure or during mod development.\n\n'
      + 'Please note that if the index you choose is not possible because it\'s too low '
      + 'or too high, the plugin is prepended/appended to the list and will not have the expected '
      + 'mod index.\n\n'
      + 'Further note: This lets you place non-master esps before masters but the game '
      + 'will not load them in this order.'),
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
      const toInsert: { [idx: number]: string } = Object.keys(fixed).reduce((prev, key) => {
        prev[fixed[key]] = key;
        return prev;
      }, {});

      let currentIndex: number = Object.keys(plugins).filter(
        key => plugins[key].isNative && (path.extname(key) !== '.esl')).length;

      // insert the plugins where the locked index is too low at the beginning
      // TODO: This is rather inefficient but it should also not run too often
      const prependOffset = 0;
      while (true) {
        const lowIdx =
          Object.keys(toInsert)
                .map(idx => parseInt(idx, 10))
                .sort()
                .find(idx => (idx <= currentIndex));
        if (lowIdx === undefined) {
          break;
        }
        sorted.splice(prependOffset, 0, toInsert[lowIdx]);
        delete toInsert[lowIdx];
        ++currentIndex;
      }

      // tslint:disable-next-line:prefer-for-of
      for (let idx = 0; (idx < sorted.length) && (Object.keys(toInsert).length > 0); ++idx) {
        if (!newState[sorted[idx]].enabled) {
          continue;
        }
        if (path.extname(sorted[idx]) === '.esl') {
          continue;
        }

        ++currentIndex;
        if (toInsert[currentIndex] !== undefined) {
          sorted.splice(idx + 1, 0, toInsert[currentIndex]);
          delete toInsert[currentIndex];
        }
      }
      Object.keys(toInsert).forEach(idx => {
        sorted.push(toInsert[idx]);
      });
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
