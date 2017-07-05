import { IExtensionContext } from '../../types/IExtensionContext';
import settingsReducer from './reducers';
import SettingsUpdate from './SettingsUpdate';

import setupAutoUpdater from './autoupdater';

import {ipcRenderer} from 'electron';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Vortex', SettingsUpdate);
  context.registerReducer(['settings', 'update'], settingsReducer);

  context.onceMain(() => {
    setupAutoUpdater(context.api);
  });

  context.once(() => {
    let haveSetChannel = false;
    // check for update when the user changes the update channel
    context.api.onStateChange(['settings', 'update', 'channel'],
      (oldChannel: string, newChannel: string) => {
        ipcRenderer.send('set-update-channel', newChannel);
        haveSetChannel = true;
    });
    // unless the user changes the update channel before,
    // check for update in 5 seconds
    setTimeout(() => {
      if (!haveSetChannel) {
        const channel = context.api.store.getState().settings.update.channel;
        ipcRenderer.send('set-update-channel', channel);
      }
    }, 5000);
  });

  return true;
}

export default init;
