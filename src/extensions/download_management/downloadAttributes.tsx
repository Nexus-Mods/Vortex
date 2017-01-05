import { ITableAttribute } from '../../types/ITableAttribute';

import { IDownload } from './types/IDownload';

import * as React from 'react';
import {ProgressBar} from 'react-bootstrap';

export const FILE_NAME: ITableAttribute = {
  id: 'filename',
  name: 'Filename',
  description: 'Name of the download',
  icon: '',
  calc: (attributes: IDownload) => attributes.localPath,
  isDetail: false,
  isToggleable: false,
  isReadOnly: true,
  isSortable: true,
};

function progress(props) {
  const {t, download} = props;
  const {state, received, size} = download;

  switch (state) {
    case 'init': return <span>{t('Pending')}</span>;
    case 'finished': return <span>{t('Finished')}</span>;
    case 'failed': return <span>{t('Failed')}</span>;
    case 'paused': return <span>{t('Paused')}</span>;
    default: {
      let label = ((received * 100) / size).toFixed(0);
      return (
        <ProgressBar now={received} max={size} label={`${label} %`} />
      );
    }
  }
}

export const PROGRESS: ITableAttribute = {
  id: 'progress',
  name: 'Progress',
  description: 'Download progress',
  icon: 'clock-o',
  customRenderer: (download: IDownload, t: I18next.TranslationFunction) =>
    progress({ download, t }),
  isDetail: false,
  isToggleable: true,
  isReadOnly: true,
  isSortable: true,
};
