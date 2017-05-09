/**
 * Extension for editing and visualising mod dependencies
 */

import determineConflicts from './util/conflicts';
import ConflictEditor from './views/ConflictEditor';
import Connector from './views/Connector';
import DependencyIcon from './views/DependencyIcon';
import Editor from './views/Editor';
import ProgressFooter from './views/ProgressFooter';

import { setConflictInfo } from './actions';
import connectionReducer from './reducers';

import { actions, selectors, types, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';

function main(context: types.IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Relations to other mods',
    icon: 'plug',
    placement: 'table',
    customRenderer: (mod, detailCell, t) => <DependencyIcon mod={mod} t={t} />,
    calc: (mod) => null,
    isToggleable: true,
    edit: {},
    isSortable: false,
  });

  context.registerReducer(['session', 'dependencies'], connectionReducer);
  context.registerDialog('mod-dependencies-connector', Connector);
  context.registerDialog('mod-dependencies-editor', Editor);
  context.registerDialog('mod-conflict-editor', ConflictEditor);
  context.registerFooter('conflict-progress', ProgressFooter);

  context.registerStyle(path.join(__dirname, 'dependency-manager.scss'));

  context.once(() => {
    const store = context.api.store;
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
        .then((conflictMap) => {
          store.dispatch(setConflictInfo(conflictMap));
        })
        .finally(() => {
          store.dispatch(actions.stopActivity('mods', 'conflicts'));
        });
    });

    // TODO: conflicts aren't currently updated unless the profile changes
  });

  return true;
}

export default main;
