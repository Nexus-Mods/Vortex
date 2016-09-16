import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { remote } from 'electron';

function setupAutoUpdate(api: IExtensionApi) {
  if (remote === undefined) {
    log('error', 'auto updater expected to be run in renderer thread');
    return;
  }

  const app = remote.app;
  const autoUpdater = remote.autoUpdater;

  const channel: string = api.getState().settings.update.channel;
  autoUpdater.setFeedURL(`http://localhost:6000/update/channel/${channel}/win32/${app.getVersion()}`);
  try {
    autoUpdater.checkForUpdates();
  } catch (e) {
    api.showErrorNotification('checking for update failed', e.message);
    return;
  }

  autoUpdater.on('update-available', () => {
    log('info', 'update available');
  });
  autoUpdater.on('update-not-available', () => {
    log('info', 'no update available');
  });
  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) => {
    log('info', 'update installed');
    api.sendNotification({
      type: 'success',
      message: 'Update available',
      displayMS: 10000,
      actions: [{
        title: 'Restart & Install',
        action: () => { quitAndUpdate(); },
      }],
    });
  });
}

export default setupAutoUpdate;
