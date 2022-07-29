import DateTimeFilter from '../../controls/table/DateTimeFilter';
import ZoomableImage from '../../controls/ZoomableImage';
import { ITableAttribute } from '../../types/ITableAttribute';
import { getCurrentLanguage } from '../../util/i18n';
import { userFriendlyTime } from '../../util/relativeTime';
import { getSafe } from '../../util/storeHelper';

import { IModWithState } from './types/IModProps';

import * as React from 'react';
import { IExtensionApi } from '../../types/api';

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

export const DOWNLOAD_TIME = (getApi: () => IExtensionApi): ITableAttribute<IModWithState> => {
  return {
    id: 'downloadTime',
    name: 'Downloaded Time',
    description: 'Time when this mod\'s archive was downloaded',
    icon: 'calendar-plus-o',
    customRenderer: (mod: IModWithState, detail: boolean, t) => {
      const archiveId = mod.archiveId;
      const state = getApi().getState();
      const download = state.persistent.downloads.files[archiveId];
      if (!archiveId || !download) {
        return <span>{t('Unknown')}</span>;
      }

      const timeString = getSafe(download, ['fileTime'], undefined);
      if (detail) {
        const lang = getCurrentLanguage();
        return (
          <span>
            {
              download.fileTime !== undefined
                ? new Date(timeString).toLocaleString(lang)
                : <span>{t('Unknown')}</span>
            }
          </span>
        );
      } else {
        if (timeString === undefined) {
          return <span>{t('Unknown')}</span>;
        }
        return <span>{userFriendlyTime(new Date(timeString), t, getApi().locale())}</span>;
      }
    },
    calc: (mod: IModWithState) => {
      const archiveId = mod.archiveId;
      const state = getApi().getState();
      const download = state.persistent.downloads?.files?.[archiveId];
      if (!archiveId || !download) {
        return new Date(0);
      }

      const timeString = getSafe(download, ['fileTime'], undefined);
      return timeString !== undefined
        ? new Date(timeString)
        : new Date(0);
    },
    placement: 'both',
    isToggleable: true,
    isDefaultVisible: false,
    edit: {},
    isSortable: true,
    sortFunc: (lhs: Date, rhs: Date) =>
      (lhs.getTime() || new Date(0).getTime()) - (rhs.getTime() || new Date(0).getTime()),
    filter: new DateTimeFilter(),
  };
};
