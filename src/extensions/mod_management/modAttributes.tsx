import DateTimeFilter from '../../controls/table/DateTimeFilter';
import ZoomableImage from '../../controls/ZoomableImage';
import { ITableAttribute } from '../../types/ITableAttribute';
import { getCurrentLanguage } from '../../util/i18n';
import { userFriendlyTime } from '../../util/relativeTime';
import { getSafe } from '../../util/storeHelper';

import { IModWithState } from './types/IModProps';
import Description from './views/Description';

import { TFunction } from 'i18next';
import * as React from 'react';

export const PICTURE: ITableAttribute<IModWithState> = {
  id: 'picture',
  description: 'A picture provided by the author',
  customRenderer: (mod: IModWithState, detail: boolean, t: TFunction) => {
    const long = getSafe(mod, ['attributes', 'description'], '');
    const short = getSafe(mod, ['attributes', 'shortDescription'], '');

    const url = getSafe(mod, ['attributes', 'pictureUrl'], undefined);
    return (
      <ZoomableImage className='mod-picture' url={url}>
        <Description
          t={t}
          long={long}
          short={short}
        />
      </ZoomableImage>
    );
  },
  calc: mod => getSafe(mod.attributes, ['pictureUrl'], ''),
  placement: 'detail',
  position: 10,
  edit: {},
};

export const ENABLED_TIME = (locale: () => string): ITableAttribute<IModWithState> => {
  return {
    id: 'enabledTime',
    name: 'Enabled Time',
    description: 'Time when this mod was enabled (in this profile)',
    icon: 'calendar-plus-o',
    customRenderer: (mod: IModWithState, detail: boolean, t) => {
      const timeStamp = mod.enabledTime;
      if (detail) {
        const lang = getCurrentLanguage();
        return (
          <span>
            {
              timeStamp !== undefined
                ? new Date(timeStamp).toLocaleString(lang)
                : t('Never enabled')
            }
          </span>
        );
      } else {
        if (timeStamp === undefined) {
          return <span>{t('Never')}</span>;
        }
        return <span>{userFriendlyTime(new Date(timeStamp), t, locale())}</span>;
      }
    },
    calc: (mod: IModWithState) => new Date(mod.enabledTime),
    placement: 'both',
    isToggleable: true,
    isDefaultVisible: false,
    edit: {},
    isSortable: true,
    sortFunc: (lhs: Date, rhs: Date) => (lhs.getTime() || 0) - (rhs.getTime() || 0),
    filter: new DateTimeFilter(),
  };
};

export const INSTALL_TIME = (locale: () => string): ITableAttribute<IModWithState> => {
  return {
    id: 'installTime',
    name: 'Installation Time',
    description: 'Time when this mod was installed',
    icon: 'calendar-plus-o',
    customRenderer: (mod: IModWithState, detail: boolean, t) => {
      const timeString = getSafe(mod, ['attributes', 'installTime'], undefined);
      if (detail) {
        const lang = getCurrentLanguage();
        return (
          <span>
            {
              timeString !== undefined
                ? new Date(timeString).toLocaleString(lang)
                : t('Not installed')
            }
          </span>
        );
      } else {
        if (timeString === undefined) {
          return <span>{t('Not installed')}</span>;
        }
        return <span>{userFriendlyTime(new Date(timeString), t, locale())}</span>;
      }
    },
    calc: (mod: IModWithState) => new Date(getSafe(mod.attributes, ['installTime'], 0)),
    placement: 'both',
    isToggleable: true,
    isDefaultVisible: false,
    edit: {},
    isSortable: true,
    sortFunc: (lhs: Date, rhs: Date) => (lhs.getTime() || 0) - (rhs.getTime() || 0),
    filter: new DateTimeFilter(),
  };
};
