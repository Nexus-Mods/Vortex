import { showDialog } from '../../actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { UserCanceled } from '../../util/api';
import { log } from '../../util/log';
import { truthy } from '../../util/util';

import {ipcMain} from 'electron';
import {autoUpdater as AUType, UpdateInfo} from 'electron-updater';
import * as semver from 'semver';

interface IProgressInfo {
  bps: number;
  percent: number;
  total: number;
  transferred: number;
}

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  const state: IState = api.store.getState();
  let notified: boolean = false;

  const queryUpdate = (version: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (semver.satisfies(version, '^' + autoUpdater.currentVersion.version)) {
        // don't warn on a "compatible" update
        return resolve();
      }

      notified = true;

      api.sendNotification({
        id: 'vortex-update-notification',
        type: 'info',
        title: 'Major update available',
        message: 'After installing this update you shouldn\'t go back to an older version.',
        noDismiss: true,
        actions: [
          {
            title: 'Download', action: dismiss => {
              dismiss();
              resolve();
            },
          },
          {
            title: 'Remind me later',
            action: dismiss => {
              dismiss();
              reject(new UserCanceled());
            },
          },
        ],
      });
    });
  };

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
    } else if ((err.message === 'net::ERR_CONNECTION_RESET')
               || (err.message === 'net::ERR_NAME_NOT_RESOLVED')) {
      api.showErrorNotification(
        'Checking for update failed',
        'This was probably a temporary network problem, please try again later.',
        { allowReport: false });
    } else {
      api.showErrorNotification('Checking for update failed', err, { allowReport: false });
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log('info', 'update available');
    queryUpdate(info.version)
      .then(() => autoUpdater.downloadUpdate()
        .catch(err => {
          log('warn', 'Downloading update failed', err);
        }))
      .catch(() => null);
  });

  autoUpdater.on('update-not-available', () => {
    log('info', 'no update available');
  });

  autoUpdater.on('download-progress', (progress: IProgressInfo) => {
    if (notified) {
      api.sendNotification({
        id: 'vortex-update-notification',
        type: 'activity',
        message: 'Downloading update',
        progress: progress.percent,
      });
    }
  });

  autoUpdater.on('update-downloaded',
    (info: UpdateInfo) => {
      log('info', 'update installed');
      api.sendNotification({
        id: 'vortex-update-notification',
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

  const checkNow = (channel: string) => {
    autoUpdater.allowPrerelease = channel === 'beta';
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates()
      .then(check => {
        if (truthy(check.downloadPromise)) {
          check.downloadPromise.catch(err => {
            log('warn', 'Checking for update failed', err);
          });
        }
      })
      .catch(err => {
        log('warn', 'Checking for update failed', err);
      });
  };

  ipcMain.on('check-for-updates', (channel: string) => {
    checkNow(channel);
  });

  ipcMain.on('set-update-channel', (event) => {
    try {
      log('info', 'set channel');
      const { channel } = state.settings.update;
      if ((channel !== 'none') && (process.env.NODE_ENV !== 'development')) {
        checkNow(channel);
      }
    } catch (err) {
      log('warn', 'Checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
