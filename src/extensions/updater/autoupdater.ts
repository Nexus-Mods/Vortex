import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { log } from '../../util/log';

import {ipcMain} from 'electron';
import {autoUpdater as AUType} from 'electron-updater';

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  const state: IState = api.store.getState();

  autoUpdater.on('error', (err) => {
    api.showErrorNotification('checking for update failed', err);
  });

  autoUpdater.on('update-available', () => {
                 log('info', 'update available'); });
  autoUpdater.on('update-not-available', () => {
                 log('info', 'no update available'); });
  autoUpdater.on('update-downloaded',
                 (event, releaseNotes, releaseName, releaseDate, updateUrl,
                  quitAndUpdate) => {
                   log('info', 'update installed');
                   api.sendNotification({
                     type: 'success',
                     message: 'Update available',
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
      const { channel } = state.settings.update;
      if ((channel !== 'none') && (process.env.NODE_ENV !== 'development')) {
        autoUpdater.allowPrerelease = channel === 'beta';
        autoUpdater.checkForUpdates();
      }
    } catch (err) {
      api.showErrorNotification('checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
