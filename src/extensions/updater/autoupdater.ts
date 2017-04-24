import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import {ipcMain} from 'electron';
import {autoUpdater as AUType} from 'electron-updater';

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  autoUpdater.on('error', (err) => {
    api.showErrorNotification('checking for update failed', err);
  });

  autoUpdater.on('update-available',
                 () => { log('info', 'update available'); });
  autoUpdater.on('update-not-available',
                 () => { log('info', 'no update available'); });
  autoUpdater.on('update-downloaded',
                 (event, releaseNotes, releaseName, releaseDate, updateUrl,
                  quitAndUpdate) => {
                   log('info', 'update installed');
                   api.sendNotification({
                     type: 'success',
                     message: 'Update available',
                     displayMS: 10000,
                     actions: [
                       {
                         title: 'Restart & Install',
                         action: () => { quitAndUpdate(); },
                       },
                     ],
                   });
                 });

  ipcMain.on('set-update-channel', (event) => {
    try {
      log('info', 'set channel');
      // TODO: the auto updater requires a public github repo
      // autoUpdater.checkForUpdates();
    } catch (err) {
      api.showErrorNotification('checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
