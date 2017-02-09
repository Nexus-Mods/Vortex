import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId } from '../../util/selectors';
import Icon from '../../views/Icon';

import {modsReducer} from './reducers/mods';
import HighlightButtons from './views/HighlightButtons';

import * as React from 'react';

function init(context: IExtensionContext): boolean {

  context.registerReducer(['persistent', 'mods'], modsReducer);

  context.registerTableAttribute('mods', {
    id: 'icon',
    name: 'Icon',
    description: 'Mod Icon',
    icon: 'eye',
    placement: 'table',
    customRenderer: (mod) => getModIcon(mod),
    calc: (mod) => mod.modIcon,
    isToggleable: true,
    edit: {},
    isSortable: true,
  });

  context.registerTableAttribute('mods', {
    id: 'notes',
    name: 'Notes',
    description: 'Mod Notes',
    icon: 'sticky-note',
    placement: 'detail',
    calc: (mod) => mod.modNotes,
    isToggleable: false,
    edit: {
      onChangeValue: () => null,
    },
    isSortable: false,
  });

  context.registerTableAttribute('mods', {
    id: 'modHighlight',
    name: 'Mod Highlight',
    description: 'Mod Highlight',
    icon: 'lightbulb-o',
    placement: 'table',
    customRenderer: (mod) => getHighlightIcons(context.api, mod),
    calc: (mod) => null,
    isToggleable: true,
    edit: {},
    isSortable: false,
  });

  return true;
}

function getModIcon(mod) {
  if (mod.modIcon !== undefined) {
    return (
      <div style={{ textAlign: 'center', background: mod.modColor }}>
        <Icon name={mod.modIcon} />
      </div>
    );
  } else {
    return (
      <div style={{ textAlign: 'center', background: mod.modColor, minHeight: 18 }} />
    );
  }
}

function getHighlightIcons(api: IExtensionApi, mod) {
  const gameMode = activeGameId(api.store.getState());
  return (
    <HighlightButtons
      gameMode={gameMode}
      t={api.translate}
      modId={mod.id}
      api={api}
    />
  );
}

export default init;
