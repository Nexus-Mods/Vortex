import HighlightButton from './views/HighlightButton';
import TextareaNotes from './views/TextareaNotes';

import * as React from 'react';
import { selectors, types, util } from 'vortex-api';

function init(context: types.IExtensionContext) {

  context.registerTableAttribute('mods', {
    id: 'notes',
    description: 'Mod Notes',
    icon: 'sticky-note',
    placement: 'detail',
    supportsMultiple: true,
    customRenderer: (mods, detailCell, t) => {
      const gameMode = selectors.activeGameId(context.api.store.getState());
      return (<TextareaNotes gameMode={gameMode} mods={mods} />);
    },
    calc: (mod) => util.getSafe(mod.attributes, ['notes'], ''),
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
      const gameMode = selectors.activeGameId(context.api.store.getState());
      return (<HighlightButton gameMode={gameMode} mod={mod} />);
    },
    calc: (mod) => util.getSafe(mod.attributes, ['icon'], ''),
    isToggleable: true,
    edit: {},
    isSortable: true,
    isDefaultVisible: false,
  });

  return true;
}

export default init;
