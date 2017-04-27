import {ITableAttribute} from '../../types/ITableAttribute';
import { getCurrentLanguage } from '../../util/i18n';
import relativeTime from '../../util/relativeTime';
import {getSafe} from '../../util/storeHelper';
import DateTimeFilter from '../../views/table/DateTimeFilter';

import { IModWithState } from './types/IModProps';

import * as React from 'react';

export const INSTALL_TIME: ITableAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  customRenderer: (mod: IModWithState, detail: boolean, t) => {
    if (detail) {
      const lang = getCurrentLanguage();
      return (
        <p>
          {new Date(getSafe(mod.attributes, ['installTime'], '')).toLocaleString(lang)}
        </p>
      );
    } else {
      return <p>{ relativeTime(new Date(getSafe(mod.attributes, ['installTime'], '')), t) }</p>;
    }
  },
  calc: (mod: IModWithState) => new Date(getSafe(mod.attributes, ['installTime'], '')),
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
  filter: new DateTimeFilter(),
};
