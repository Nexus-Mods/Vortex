import {ITableAttribute} from '../../types/ITableAttribute';
import {getSafe} from '../../util/storeHelper';

import {IMod} from './types/IMod';

export const MOD_NAME: ITableAttribute = {
  id: 'name',
  name: 'Mod Name',
  description: 'Name of the mod',
  icon: 'quote-left',
  calc: (mod: IMod) =>
    getSafe(mod.attributes, ['logicalFileName'], getSafe(mod.attributes, ['name'], '')),
  placement: 'both',
  isToggleable: false,
  edit: {},
  isSortable: true,
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
  },
};

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

export const VERSION: ITableAttribute = {
  id: 'version',
  name: 'Version',
  description: 'File version (according to the author)',
  icon: 'birthday-cake',
  calc: (mod: IMod) => getSafe(mod.attributes, ['version'], ''),
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
};
