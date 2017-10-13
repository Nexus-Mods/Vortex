import HighlightButton from './views/HighlightButton';
import TextareaNotes from './views/TextareaNotes';

import * as I18next from 'i18next';
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
    customRenderer: (mod: types.IMod, detailCell: boolean, t: I18next.TranslationFunction) =>
      <HighlightButton mod={mod} />,
    calc: (mod: types.IMod) =>
      util.getSafe(mod.attributes, ['icon'], '')
      + ' - ' + util.getSafe(mod.attributes, ['color'], ''),
    isToggleable: true,
    edit: {},
    isSortable: true,
    isDefaultVisible: false,
  });

  return true;
}

export default init;
