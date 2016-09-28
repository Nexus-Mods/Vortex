import { IModAttribute } from './types/IModAttribute';

export const MOD_NAME: IModAttribute = {
  id: 'name',
  name: 'Mod Name',
  description: 'Name of the mod',
  icon: 'quote-left',
  isDetail: false,
  sortFunc: (lhs: string, rhs: string, locale: string): number => {
    return lhs.localeCompare(rhs, locale, { sensitivity: 'case' });
  } 
};

export const INSTALL_TIME: IModAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  isDetail: false,
};
