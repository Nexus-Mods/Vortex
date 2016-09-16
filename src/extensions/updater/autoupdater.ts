import { app, autoUpdater, dialog } from 'electron';

import { log } from '../../util/log';

// auto updater

function setupAutoUpdate(channel) {
  autoUpdater.setFeedURL(`http://localhost:6000/update/channel/${channel}/win32/${app.getVersion()}`);
  try {
    autoUpdater.checkForUpdates();
  } catch (e) {
    log('warn', 'checking for update failed', e);
    return;
  }

  autoUpdater.on('update-available', () => {
    log('info', 'update available');
  });
  autoUpdater.on('update-not-available', () => {
    log('info', 'no update available');
  });
  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) => {
    dialog.showMessageBox(mainWindow, {
        type: 'question', buttons: ['Later', 'Restart'],
        title: 'Update available', message: 'NMM2 was updated. You can now restart to use the new version.'
      },
      (response) => { if (response === 1) { quitAndUpdate(); } });
  });
}

export default setupAutoUpdate;