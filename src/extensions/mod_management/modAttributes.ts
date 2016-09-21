import { IModAttribute } from './types/IModAttribute';

export const MOD_NAME: IModAttribute = {
  id: 'name',
  name: 'Mod Name',
  description: 'Name of the mod',
  icon: 'quote-left',
  isDetail: false,
};

export const INSTALL_TIME: IModAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  isDetail: false,
};
