import {ITableAttribute} from '../../types/ITableAttribute';
import {getSafe} from '../../util/storeHelper';

import Icon from '../../views/Icon';

import {IMod} from './types/IMod';

import * as React from 'react';

export const INSTALL_TIME: ITableAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  calc: (mod: IMod) => new Date(getSafe(mod.attributes, ['installTime'], '')),
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
};

export const ENDORSED: ITableAttribute = {
  id: 'endorsed',
  name: 'Endorsed',
  description: 'Endorsed',
  icon: 'star',
  customRenderer: (mod: IMod) => getEndorsedIcon(mod),
  calc: (mod: IMod) => getSafe(mod.attributes, ['endorsed'], ''),
  placement: 'table',
  isToggleable: true,
  edit: {},
  isSortable: true,
};

function getEndorsedIcon(mod: IMod) {
  if (getSafe(mod.attributes, ['endorsed'], '')) {
    return <div style={{ textAlign: 'center' }}><Icon name={'star'} /></div>;
  } else {
    return <div style={{ textAlign: 'center' }}><Icon name={'star-o'} /></div>;
  }
}
