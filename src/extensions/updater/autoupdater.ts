import { showDialog } from '../../actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { log } from '../../util/log';
import { spawnSelf } from '../../util/util';

import {app, ipcMain} from 'electron';
import {autoUpdater as AUType, UpdateInfo} from 'electron-updater';

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  const state: IState = api.store.getState();

  autoUpdater.on('error', (err) => {
    if ((err.cmd !== undefined) && err.cmd.startsWith('powershell.exe')) {
      api.showErrorNotification(
        'Checking for update failed',
        'Failed to verify the signature of the update file. This is probably caused '
        + 'by an outdated version of powershell or security settings that prevent Vortex from '
        + 'running it.\n'
        + 'You could try updating powershell, otherwise please disable automatic updates '
        + 'and update Vortex manually.',
        { allowReport: false });
    } else if (err.message === 'Unexpected end of JSON input') {
      api.showErrorNotification(
        'Checking for update failed',
        'Failed to verify the signature of the update file, please try again later.',
        { allowReport: false });
    } else if (err.message === 'net::ERR_CONNECTION_RESET') {
      api.showErrorNotification(
        'Checking for update failed',
        'This was probably a temporary network problem, please try again later.',
        { allowReport: false });
    } else {
      api.showErrorNotification('Checking for update failed', err, { allowReport: false });
    }
  });

  autoUpdater.on('update-available', () => {
                 log('info', 'update available'); });
  autoUpdater.on('update-not-available', () => {
                 log('info', 'no update available'); });
  autoUpdater.on('update-downloaded',
                 (info: UpdateInfo) => {
                   log('info', 'update installed');
                   api.sendNotification({
                     type: 'success',
                     message: 'Update available',
                     actions: [
                       {
                         title: 'Changelog',
                         action: () => {
                           api.store.dispatch(showDialog('info', `Changelog ${info.version}`, {
                             htmlText: info.releaseNotes as string,
                           }, [
                             { label: 'Close' },
                           ]));
                         },
                       },
                       {
                         title: 'Restart & Install',
                         action: () => {
                           autoUpdater.quitAndInstall();
                         },
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
        autoUpdater.checkForUpdates()
        .then(check => {
          if (check.downloadPromise !== undefined) {
            check.downloadPromise.catch(err => {
              log('warn', 'Checking for update failed', err);
            });
          }
        })
        .catch(err => {
          log('warn', 'Checking for update failed', err);
        });
      }
    } catch (err) {
      log('warn', 'Checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
