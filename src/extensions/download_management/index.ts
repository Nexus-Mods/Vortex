import { IExtensionContext } from '../../types/IExtensionContext';

import { downloadPath } from '../mod_management/selectors';

import { setDownloadSpeed} from './actions/state';
import { settingsReducer } from './reducers/settings';
import { stateReducer } from './reducers/state';
import DownloadView from './views/DownloadView';
import Settings from './views/Settings';
import SpeedOMeter from './views/SpeedOMeter';

import DownloadManager from './DownloadManager';
import observe from './DownloadObserver';

import { app as appIn, remote } from 'electron';

const app = remote !== undefined ? remote.app : appIn;

function init(context: IExtensionContext): boolean {
  context.registerMainPage('download', 'Download', DownloadView, {
    hotkey: 'D',
  });

  context.registerSettings('Download', Settings);

  context.registerFooter('speed-o-meter', SpeedOMeter);

  context.registerReducer(['persistent', 'downloads'], stateReducer);
  context.registerReducer(['settings', 'downloads'], settingsReducer);

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
        if ((speed !== 0) || (store.getState().persistent.downloads.speed !== 0)) {
          store.dispatch(setDownloadSpeed(speed));
        }
      },
      `Nexus Client v2.${app.getVersion()}`
    );
    observeImpl(context.api.events, store, manager);
  });

  return true;
}

export default init;
