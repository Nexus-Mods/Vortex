/* eslint-disable */
import path from 'path';
import { actions, selectors, types, util } from 'vortex-api';

import { GAME_ID, I18N_NAMESPACE, LOCKED_PREFIX } from './common';
import { PriorityManager } from './priorityManager';

import TW3LoadOrder, { importLoadOrder } from './loadOrder';
import { makeOnContextImport } from './mergeBackup';

import { forceRefresh } from './util';
import { getPersistentLoadOrder } from './migrations';

interface IProps {
  context: types.IExtensionContext;
  getPriorityManager: () => PriorityManager;
  // getModLimitPatcher: () => ModLimitPatcher;
}

export const registerActions = (props: IProps) => {
  const { context } = props;
  const openTW3DocPath = () => {
    const docPath = path.join(util.getVortexPath('documents'), 'The Witcher 3');
    util.opn(docPath).catch(() => null);
  };

  const isTW3 = (gameId = undefined) => {
    if (gameId !== undefined) {
      return (gameId === GAME_ID);
    }
    const state = context.api.getState();
    const gameMode = selectors.activeGameId(state);
    return (gameMode === GAME_ID);
  };

  context.registerAction('mods-action-icons', 300, 'start-install', {}, 'Import Script Merges',
    instanceIds => { makeOnContextImport(context.api, instanceIds[0]); },
    instanceIds => {
      const state = context.api.getState();
      const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
      if (mods[instanceIds?.[0]]?.type !== 'collection') {
        return false;
      }
      const activeGameId = selectors.activeGameId(state);
      return activeGameId === GAME_ID;
    });

  context.registerAction('mods-action-icons', 300, 'start-install', {}, 'Import Load Order',
    instanceIds => { importLoadOrder(context.api, instanceIds[0]); },
    instanceIds => {
      const state = context.api.getState();
      const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
      if (mods[instanceIds?.[0]]?.type !== 'collection') {
        return false;
      }
      const activeGameId = selectors.activeGameId(state);
      return activeGameId === GAME_ID;
    });

  // context.registerAction('mod-icons', 500, 'savegame', {}, 'Apply Mod Limit Patch', () => {
  //   getModLimitPatcher().ensureModLimitPatch()
  //     .catch(err => {
  //       context.api.showErrorNotification('Failed to apply patch', err, {
  //         allowReport: (err instanceof util.ProcessCanceled),
  //       });
  //     });
  // }, () => selectors.activeGameId(context.api.getState()) === GAME_ID);

  context.registerAction('mod-icons', 300, 'open-ext', {},
    'Open TW3 Documents Folder', openTW3DocPath, isTW3);

  context.registerAction('fb-load-order-icons', 300, 'open-ext', {},
    'Open TW3 Documents Folder', openTW3DocPath, isTW3);

  context.registerAction('fb-load-order-icons', 100, 'loot-sort', {}, 'Sort by Deploy Order',
    () => {
      context.api.showDialog('info', 'Sort by Deployment Order', {
        bbcode: context.api.translate('This action will set priorities using the deployment rules '
          + 'defined in the mods page. Are you sure you wish to proceed ?[br][/br][br][/br]'
          + 'Please be aware that any externally added mods (added manually or by other tools) will be pushed '
          + 'to the bottom of the list, while all mods that have been installed through Vortex will shift '
          + 'in position to match the deploy order!', { ns: I18N_NAMESPACE }),
      }, [
        {
          label: 'Cancel', action: () => {
            return;
          }
        },
        {
          label: 'Sort by Deploy Order', action: () => {
            const state = context.api.getState();
            const gameMods = state.persistent.mods?.[GAME_ID] || {};
            const profile = selectors.activeProfile(state);
            const mods = Object.keys(gameMods)
              .filter(key => util.getSafe(profile, ['modState', key, 'enabled'], false))
              .map(key => gameMods[key]);
            const findIndex = (entry: types.ILoadOrderEntry, modList: types.IMod[]) => {
              return modList.findIndex(m => m.id === entry.modId);
            }
            return util.sortMods(GAME_ID, mods, context.api)
              .then(sorted => {
                const loadOrder = getPersistentLoadOrder(context.api);
                const filtered = loadOrder.filter(entry =>
                  sorted.find(mod => mod.id === entry.id) !== undefined);
                const sortedLO = filtered.sort((a, b) => findIndex(a, sorted) - findIndex(b, sorted));
                const locked = loadOrder.filter(entry => entry.name.includes(LOCKED_PREFIX));
                const manuallyAdded = loadOrder.filter(key => !filtered.includes(key) && !locked.includes(key));
                const newLO = [...locked, ...sortedLO, ...manuallyAdded].reduce((accum, entry, idx) => {
                  accum.push({
                    ...entry,
                    data: {
                      prefix: idx + 1
                    }
                  });
                  return accum;
                }, []);

                context.api.store.dispatch(actions.setLoadOrder(profile.id, newLO as any));
              })
              .catch(err => {
                const allowReport = !(err instanceof util.CycleError);
                context.api.showErrorNotification('Failed to sort by deployment order', err,
                  { allowReport });
              }).finally(() => {
                forceRefresh(context.api);
              });
          }
        },
      ]);
    }, () => {
      const state = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return gameMode === GAME_ID;
    });
};
