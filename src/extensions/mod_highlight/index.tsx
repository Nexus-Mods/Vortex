import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { modsReducer } from '../mod_management/reducers/mods';

import HighlightButton from './views/HighlightButton';
import TextareaNotes from './views/TextareaNotes';

import * as React from 'react';

function init(context: IExtensionContext): boolean {

  context.registerReducer(['persistent', 'mods'], modsReducer);

  context.registerTableAttribute('mods', {
    id: 'notes',
    name: 'Notes',
    description: 'Mod Notes',
    icon: 'sticky-note',
    placement: 'detail',
    customRenderer: (mod) => getTextArea(context.api, mod),
    calc: (mod) => getSafe(mod.attributes, ['notes'], ''),
    isToggleable: false,
    edit: {},
    isSortable: false,
  });

  context.registerTableAttribute('mods', {
    id: 'modHighlight',
    name: 'Highlight',
    description: 'Mod Highlight',
    icon: 'lightbulb-o',
    placement: 'table',
    customRenderer: (mod) => getHighlightIcon(context.api, mod),
    calc: (mod) => getSafe(mod.attributes, ['icon'], ''),
    isToggleable: true,
    edit: {},
    isSortable: true,
  });

  return true;
}

function getTextArea(api: IExtensionApi, mod) {
    const gameMode = activeGameId(api.store.getState());
    return (
      <TextareaNotes
        gameMode={gameMode}
        mod={mod}
      />
    );
  }

function getHighlightIcon(api: IExtensionApi, mod) {
  const gameMode = activeGameId(api.store.getState());
  return (
    <HighlightButton
      gameMode={gameMode}
      t={api.translate}
      mod={mod}
    />
  );
}

export default init;
