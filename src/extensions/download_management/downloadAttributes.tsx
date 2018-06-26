import ProgressBar from '../../controls/ProgressBar';
import TextFilter from '../../controls/table/TextFilter';

import { ITableAttribute } from '../../types/ITableAttribute';
import { getSafe } from '../../util/storeHelper';
import { bytesToString } from '../../util/util';

import DownloadProgressFilter from './views/DownloadProgressFilter';

import { IDownload } from './types/IDownload';

import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import * as url from 'url';

function nameFromUrl(input: string) {
  if (input === undefined) {
    return undefined;
  }

  const pathname = url.parse(input).pathname;
  if (pathname === undefined) {
    return undefined;
  }

  return decodeURI(path.basename(pathname));
}

export const FILE_NAME: ITableAttribute = {
  id: 'filename',
  name: 'Filename',
  description: 'Filename of the download',
  icon: '',
  calc: (attributes: IDownload) =>
    attributes.localPath
    || nameFromUrl(getSafe(attributes, ['urls', 0], undefined)),
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
  filter: new TextFilter(true),
};

export const LOGICAL_NAME: ITableAttribute = {
  id: 'logicalname',
  name: 'Name',
  description: 'Readable Name',
  icon: '',
  calc: (attributes: IDownload) =>
    getSafe(attributes, ['modInfo', 'name'], '') || attributes.localPath,
  placement: 'both',
  isToggleable: true,
  edit: {},
  isSortable: true,
  isDefaultVisible: false,
  filter: new TextFilter(true),
};

function progress(props) {
  const {t, download} = props;
  const {state} = download;
  const received = download.received || 0;
  const size = download.size || 1;

  switch (state) {
    case 'init': return <span>{t('Pending')}</span>;
    case 'finished': return <span>{t('Finished')}</span>;
    case 'failed': return <span>{t('Failed')}</span>;
    case 'redirect': return <span>{t('Redirected')}</span>;
    case 'paused': return <span>{t('Paused')}</span>;
    default: return (
        <ProgressBar now={received} max={size} showPercentage />
      );
  }
}

function calc(props) {
  const {download} = props;
  const {state, received, size} = download;

  if (state === 'started') {
    return (received / Math.max(size, 1));
  } else {
    return state;
  }
}

export const PROGRESS: ITableAttribute = {
  id: 'progress',
  name: 'Progress',
  description: 'Download progress',
  icon: 'clock-o',
  customRenderer: (download: IDownload, detailCell: boolean, t: I18next.TranslationFunction) =>
    progress({ download, t }),
  calc: (download: IDownload, t: I18next.TranslationFunction) => calc({download, t}),
  placement: 'table',
  isToggleable: true,
  edit: {},
  isSortable: true,
  filter: new DownloadProgressFilter(),
};

export const FILE_SIZE: ITableAttribute = {
  id: 'filesize',
  name: 'File Size',
  description: 'Total size of the file',
  icon: 'chart-bars',
  customRenderer: (download: IDownload, detailCell: boolean, t: I18next.TranslationFunction) =>
    <span>{download.size !== undefined ? bytesToString(download.size) : '???'}</span>,
  calc: (download: IDownload) => download.size,
  placement: 'table',
  isToggleable: true,
  edit: {},
  isSortable: true,
};
