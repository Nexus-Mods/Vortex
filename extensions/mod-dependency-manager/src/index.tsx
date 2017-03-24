/**
 * Extension for editing and visualising mod dependencies
 */

import determineConflicts from './util/conflicts';
import ConflictEditor from './views/ConflictEditor';
import Connector from './views/Connector';
import DependencyIcon from './views/DependencyIcon';
import Editor from './views/Editor';
import ProgressFooter from './views/ProgressFooter';

import { setConflictInfo, setConflictWorking } from './actions';
import connectionReducer from './reducers';

import { selectors, types, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';

function main(context: types.IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Relations to other mods',
    icon: 'plug',
    placement: 'table',
    customRenderer: (mod) => <DependencyIcon mod={mod} />,
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
    context.api.events.on('profile-activated', () => {
      const store = context.api.store;
      const state: types.IState = store.getState();
      const modPath = selectors.installPath(state);
      const gameId = selectors.activeGameId(state);
      const modState = selectors.activeProfile(state).modState;
      const mods = Object.keys(state.persistent.mods[gameId] || {})
        .filter(modId => util.getSafe(modState, [modId, 'enabled'], false))
        .map(modId => state.persistent.mods[gameId][modId]);
      store.dispatch(setConflictWorking(true));
      determineConflicts(modPath, mods)
        .then((conflictMap) => {
          store.dispatch(setConflictInfo(conflictMap));
          store.dispatch(setConflictWorking(false));
        });
    });
  });

  return true;
}

export default main;
