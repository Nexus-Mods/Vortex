import {getSafe} from '../../util/storeHelper';

import {IMod} from './types/IMod';
import { IModAttribute } from './types/IModAttribute';

export const MOD_NAME: IModAttribute = {
  id: 'name',
  name: 'Mod Name',
  description: 'Name of the mod',
  icon: 'quote-left',
  calc: (mod: IMod) =>
    getSafe(mod.attributes, ['logicalFileName'], getSafe(mod.attributes, ['name'], '')),
  isDetail: false,
  isToggleable: false,
  isReadOnly: false,
  isSortable: true,
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
  },
};

export const INSTALL_TIME: IModAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  calc: (mod: IMod) => new Date(getSafe(mod.attributes, ['installTime'], '')),
  isDetail: false,
  isToggleable: true,
  isReadOnly: true,
  isSortable: true,
};

export const VERSION: IModAttribute = {
  id: 'version',
  name: 'Version',
  description: 'File version (according to the author)',
  icon: 'birthday-cake',
  calc: (mod: IMod) => getSafe(mod.attributes, ['version'], ''),
  isDetail: false,
  isToggleable: true,
  isReadOnly: false,
  isSortable: true,
};
