import { IExtensionContext } from '../../types/IExtensionContext';

import { downloadPath } from '../mod_management/selectors';

import { setDownloadSpeed} from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import { ProtocolHandlers } from './types/ProtocolHandlers';
import DownloadView from './views/DownloadView';
import Settings from './views/Settings';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';
import observe from './DownloadObserver';

import { app as appIn, remote } from 'electron';

const app = remote !== undefined ? remote.app : appIn;

let observer;
let protocolHandlers: ProtocolHandlers = {};

function init(context: IExtensionContext): boolean {
  context.registerMainPage('download', 'Download', DownloadView, {
    hotkey: 'D',
  });

  context.registerSettings('Download', Settings);

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerSettingsHive('game', 'downloads');
  context.registerReducer(['downloads'], stateReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

  context.registerExtensionFunction('registerDownloadProtocol',
    (schema: string, handler: (inputUrl: string) => Promise<string[]>) => {
    protocolHandlers[schema] = handler;
  });

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode 
  context.once(() => {
    const DownloadManagerImpl: typeof DownloadManager = require('./DownloadManager').default;
    const observeImpl: typeof observe = require('./DownloadObserver').default;

    const store = context.api.store;
    const manager = new DownloadManagerImpl(
      downloadPath(store.getState()),
      store.getState().settings.downloads.maxParallelDownloads,
      store.getState().settings.downloads.maxChunks,
      (speed: number) => {
        if ((speed !== 0) || (store.getState().downloads.speed !== 0)) {
          store.dispatch(setDownloadSpeed(speed));
        }
      },
      `Nexus Client v2.${app.getVersion()}`
    );
    observer = observeImpl(context.api.events, store, manager, protocolHandlers);
  });

  return true;
}

export default init;
