import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import settingsReducer from './reducers';
import SettingsUpdate from './SettingsUpdate';

import setupAutoUpdater from './autoupdater';

import {ipcRenderer} from 'electron';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'update'], settingsReducer);
  context.registerSettings('Vortex', SettingsUpdate);

  context.onceMain(() => {
    try {
      setupAutoUpdater(context.api);
    } catch (err) {
      log('error', 'failed to check for update', err.message);
    }
  });

  context.once(() => {
    let haveSetChannel = false;
    // check for update when the user changes the update channel
    context.api.onStateChange(['settings', 'update', 'channel'],
      (oldChannel: string, newChannel: string) => {
        ipcRenderer.send('set-update-channel', newChannel, true);
        haveSetChannel = true;
    });
    // unless the user changes the update channel before,
    // check for update in 5 seconds
    setTimeout(() => {
      if (!haveSetChannel) {
        const channel = context.api.store.getState().settings.update.channel;
        ipcRenderer.send('set-update-channel', channel, false);
      }
    }, 5000);
  });

  return true;
}

export default init;
