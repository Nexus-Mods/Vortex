import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import InputButton from '../../views/InputButton';

import { accountReducer } from './reducers/account';
import LoginIcon from './views/LoginIcon';

import Nexus, { IDownloadURL, IGetModInfoResponse } from '../../../lib/js/nexus-api';

import NXMUrl from './NXMUrl';

import * as util from 'util';

const nexus = new Nexus('nmm2');

function startDownload(api: IExtensionApi, nxmurl: string) {
  const url: NXMUrl = new NXMUrl(nxmurl);

  let nexusModInfo: IGetModInfoResponse;

  nexus.getModInfo(url.modId)
  .then((data: IGetModInfoResponse) => {
    nexusModInfo = data;

    api.sendNotification({
      type: 'global',
      id: url.fileId.toString(),
      title: 'Downloading from Nexus',
      message: nexusModInfo.name,
      displayMS: 4000,
    });

    return nexus.getDownloadURLs(url.fileId);
  })
  .then((urls: IDownloadURL[]) => {
    if (urls === null) {
      throw { message: 'No download locations (yet)' };
    }
    let uris: string[] = urls.map((item: IDownloadURL) => item.URI);
    api.events.emit('start-download', uris, { nexus: nexusModInfo });
  })
  .catch((err) => {
    api.sendNotification({
      id: url.fileId.toString(),
      type: 'global',
      title: 'Download failed',
      message: err.message,
      displayMS: 2000,
    });
    log('warn', 'failed to get mod info', { err: util.inspect(err) });
  });
}

function init(context: IExtensionContext): boolean {
  context.registerFooter('login', LoginIcon, () => ({ nexus }));
  context.registerReducer([ 'account', 'nexus' ], accountReducer);

  context.registerProtocol('nxm', (url: string) => {
    startDownload(context.api, url);
  });

  let onStartDownload = (nxmurl: string) => {
    startDownload(context.api, nxmurl);
  };

  context.registerIcon('download-icons', InputButton,
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: onStartDownload,
    }));

  return true;
}

export default init;
