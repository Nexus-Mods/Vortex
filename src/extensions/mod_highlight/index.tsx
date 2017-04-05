import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import {modsReducer} from '../mod_management/reducers/mods';
import { IMod } from '../mod_management/types/IMod';

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
    customRenderer: (mod) => {
      const gameMode = activeGameId(context.api.store.getState());
      return getTextareaNotes(gameMode, mod);
    },
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
    customRenderer: (mod, detailCell, t) => {
      const gameMode = activeGameId(context.api.store.getState());
      return renderHighlightIcon(gameMode, mod, t);
    },
    calc: (mod) => getSafe(mod.attributes, ['icon'], ''),
    isToggleable: true,
    edit: {},
    isSortable: true,
    isDefaultVisible: false,
  });

  return true;
}

function getTextareaNotes(gameMode: string, mod: IMod) {
  return (
    <TextareaNotes
      gameMode={gameMode}
      mod={mod}
    />
  );
}

function renderHighlightIcon(gameMode: string, mod: IMod, t: I18next.TranslationFunction) {
  return (
    <HighlightButton
      gameMode={gameMode}
      t={t}
      mod={mod}
    />
  );
}

export default init;
