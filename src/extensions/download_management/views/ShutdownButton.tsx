import * as React from 'react';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { TFunction } from '../../../util/i18n';
import { IDownload } from '../types/IDownload';

export interface IShutdownButtonProps {
  t: TFunction;
  shutdownPending: boolean;
  activeDownloads: { [key: string]: IDownload };
  toggleShutdown: () => void;
}

function ShutdownButton(props: IShutdownButtonProps) {
  const { t, shutdownPending, activeDownloads, toggleShutdown } = props;
  return (
    <ToolbarIcon
      icon='onoff'
      text={t('Power off when done')}
      className={shutdownPending ? 'toolbar-flash-button' : undefined}
      disabled={!shutdownPending && (Object.keys(activeDownloads ?? {}).length === 0)}
      onClick={toggleShutdown}
    />
  );
}

export default ShutdownButton;
