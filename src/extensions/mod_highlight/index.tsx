import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { setModAttribute } from '../mod_management/actions/mods';
import {modsReducer} from '../mod_management/reducers/mods';

import HighlightButtons from './views/HighlightButtons';

import * as React from 'react';

function init(context: IExtensionContext): boolean {

  context.registerReducer(['persistent', 'mods'], modsReducer);

  context.registerTableAttribute('mods', {
    id: 'notes',
    name: 'Notes',
    description: 'Mod Notes',
    icon: 'sticky-note',
    placement: 'detail',
    calc: (mod) => getSafe(mod.attributes, ['notes'], ''),
    isToggleable: false,
    edit: {
      onChangeValue: (modId: string, newValue: any) => {
        const gameMode = activeGameId(context.api.store.getState());
        context.api.store.dispatch(setModAttribute(gameMode, modId, 'notes', newValue));
      },
    },
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

function getHighlightIcon(api: IExtensionApi, mod) {
  const gameMode = activeGameId(api.store.getState());
  return (
    <HighlightButtons
      gameMode={gameMode}
      t={api.translate}
      mod={mod}
      api={api}
    />
  );
}

export default init;
