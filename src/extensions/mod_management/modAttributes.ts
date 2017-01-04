import { IModAttribute } from './types/IModAttribute';

export const MOD_NAME: IModAttribute = {
  id: 'name',
  name: 'Mod Name',
  description: 'Name of the mod',
  icon: 'quote-left',
  calc: (attributes) => attributes.logicalFileName || attributes.name,
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
  calc: (attributes) => new Date(attributes.installTime),
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
  calc: (attributes) => attributes.version,
  isDetail: false,
  isToggleable: true,
  isReadOnly: false,
  isSortable: true,
};

export const CATEGORY: IModAttribute = {
  id: 'category',
  name: 'Category',
  description: 'Category',
  icon: 'book',
  calc: (attributes) => attributes.category,
  isDetail: false,
  isToggleable: true,
  isReadOnly: false,
  isSortable: true,
};

export const CATEGORY_DETAIL: IModAttribute = {
  id: 'category_detail',
  name: 'Category Detail',
  description: 'Category Detail',
  icon: 'book',
  calc: (attributes) => attributes.category_detail,
  isDetail: true,
  isToggleable: false,
  isReadOnly: false,
  isSortable: true,
};
