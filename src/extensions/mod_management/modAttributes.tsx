import {ITableAttribute} from '../../types/ITableAttribute';
import {getSafe} from '../../util/storeHelper';
import DateTimeFilter from '../../views/table/DateTimeFilter';

import { IMod } from './types/IMod';
import { IModWithState } from './types/IModProps';

export const INSTALL_TIME: ITableAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  calc: (mod: IModWithState) => new Date(getSafe(mod.attributes, ['installTime'], '')),
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
  filter: new DateTimeFilter(),
  sortFunc: (lhs: Date, rhs: Date): number => {
    return (rhs.valueOf() - lhs.valueOf());
  },
};
