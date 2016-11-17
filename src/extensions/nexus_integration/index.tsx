import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import InputButton from '../../views/InputButton';

import { accountReducer } from './reducers/account';
import { settingsReducer } from './reducers/settings';
import LoginIcon from './views/LoginIcon';
import Settings from './views/Settings';

import NXMUrl from './NXMUrl';

import * as Promise from 'bluebird';
import Nexus, { IDownloadURL, IFileInfo } from 'nexus-api';
import * as util from 'util';

let nexus: Nexus;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string,
    handler: (inputUrl: string) => Promise<string[]>) => void;
}

function startDownload(api: IExtensionApi, nxmurl: string) {
  const url: NXMUrl = new NXMUrl(nxmurl);

  let nexusFileInfo: IFileInfo;

  nexus.getFileInfo(url.modId, url.fileId, url.gameId)
  .then((fileInfo: IFileInfo) => {
    nexusFileInfo = fileInfo;
    api.sendNotification({
      id: url.fileId.toString(),
      type: 'global',
      title: 'Downloading from Nexus',
      message: fileInfo.name,
      displayMS: 4000,
    });
    return nexus.getDownloadURLs(url.modId, url.fileId, url.gameId);
  })
  .then((urls: IDownloadURL[]) => {
    if (urls === null) {
      throw { message: 'No download locations (yet)' };
    }
    let uris: string[] = urls.map((item: IDownloadURL) => item.URI);
    log('debug', 'got download urls', { uris });
    api.events.emit('start-download', uris, { nexus: {
      ids: { gameId: url.gameId, modId: url.modId, fileId: url.fileId },
      fileInfo: nexusFileInfo,
    }});
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

function init(context: IExtensionContextExt): boolean {
  context.registerFooter('login', LoginIcon, () => ({ nexus }));
  context.registerSettings('Download', Settings);
  context.registerReducer([ 'account', 'nexus' ], accountReducer);
  context.registerReducer([ 'settings', 'nexus' ], settingsReducer);

  if (context.registerDownloadProtocol !== undefined) {
    context.registerDownloadProtocol('nxm:', (nxmurl: string): Promise<string[]> => {
      const nxm: NXMUrl = new NXMUrl(nxmurl);
      return nexus.getDownloadURLs(nxm.modId, nxm.fileId, nxm.gameId)
        .map((url: IDownloadURL): string => {
          return url.URI;
        });
    });
  }

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

  context.once(() => {
    let state = context.api.store.getState();
    nexus = new Nexus(
      getSafe(state, [ 'settings', 'gameMode', 'current' ], ''),
      getSafe(state, [ 'account', 'nexus', 'APIKey' ], '')
    );
    let registerFunc = () => {
      context.api.registerProtocol('nxm', (url: string) => {
        startDownload(context.api, url);
      });
    };
    if (context.api.store.getState().settings.nexus.associateNXM) {
      registerFunc();
    }

    context.api.onStateChange([ 'settings', 'nexus', 'associateNXM' ],
      (oldValue: boolean, newValue: boolean) => {
        log('info', 'associate', { oldValue, newValue });
        if (newValue === true) {
          registerFunc();
        } else {
          context.api.deregisterProtocol('nxm');
        }
      }
    );

    context.api.onStateChange([ 'settings', 'gameMode', 'current' ],
      (oldValue: string, newValue: string) => {
        nexus.setGame(newValue);
      });

    context.api.onStateChange([ 'account', 'nexus', 'APIKey' ],
      (oldValue: string, newValue: string) => {
        nexus.setKey(newValue);
      });
  });

  return true;
}

export default init;
