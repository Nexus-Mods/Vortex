import { setUpdateChannel, showDialog } from '../../actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { getVisibleWindow, UserCanceled } from '../../util/api';
import { log } from '../../util/log';
import opn from '../../util/opn';
import { truthy } from '../../util/util';

import { NEXUS_BASE_URL } from '../nexus_integration/constants';

import {app as appIn, dialog as dialogIn, ipcMain} from 'electron';
import {autoUpdater as AUType, UpdateInfo} from 'electron-updater';
import * as semver from 'semver';
import uuidv5 from 'uuid/v5';
import { RegGetValue } from 'winapi-bindings';
import { getApplication } from '../../util/application';

let app = appIn;
let dialog = dialogIn;
if (process.type === 'renderer') {
  // tslint:disable-next-line:no-var-requires
  const remote = require('@electron/remote');
  app = remote.app;
  dialog = remote.dialog;
}

const appName = 'com.nexusmods.vortex';
const ELECTRON_BUILDER_NS_UUID = '50e065bc-3134-11e6-9bab-38c9862bdaf3';

const myguid = (() => {
  let cached: string;
  return () => {
    if (cached === undefined) {
      cached = uuidv5(appName, ELECTRON_BUILDER_NS_UUID);
    }
    return cached;
  };
})();

interface IProgressInfo {
  bps: number;
  percent: number;
  total: number;
  transferred: number;
}

function openStable() {
  opn(`${NEXUS_BASE_URL}/site/mods/1`).catch(() => null);
}

function openTesting() {
  opn('https://www.github.com/Nexus-Mods/Vortex#release').catch(() => null);
}

function updateWarning() {
  dialog.showMessageBoxSync(getVisibleWindow(), {
    type: 'info',
    title: 'Vortex update',
    message: 'Vortex will be updated after closing. '
      + 'Please do not turn off your computer until it\'s done. '
      + 'If you interrupt the installation process Vortex may stop working.',
    buttons: ['Continue'],
    noLink: true,
  });
}

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  const state: () => IState = () => api.store.getState();
  let notified: boolean = false;
  let channelOverride: 'beta';

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

  autoUpdater.on('update-not-available', () => {
    if (channelOverride !== undefined) {
      log('info', 'installed version seems to be a beta, switching update channel');
      api.store.dispatch(setUpdateChannel(channelOverride));
      api.sendNotification({
        type: 'info',
        message: 'You are running a beta version of Vortex so auto update settings have been '
               + 'changed to keep you up-to-date with current betas.',
      });
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log('info', 'found update available', info.version);
    const installedVersion = semver.parse(getApplication().version);
    const version = semver.parse(info.version);

    const channel = channelOverride ?? api.getState().settings.update.channel;

    if ((channel === 'stable')
      && ((version.major < installedVersion.major)
        || (version.minor < installedVersion.minor))) {
      log('info', 'installed version newer than the available update, check if this is a beta');
      channelOverride = 'beta';
      return;
    }

    let instPath: string;
    if (process.platform === 'win32') {
      try {
        instPath = RegGetValue('HKEY_LOCAL_MACHINE',
                               `SOFTWARE\\${myguid()}`,
                               'InstallLocation').value as string;
      } catch (err) {
        api.sendNotification({
          type: 'warning',
          message: 'Update can\'t be installed automatically',
          actions: [
            { title: 'More', action: dismiss => {
              api.showDialog('info', 'Update can\'t be installed automatically', {
                text: 'An update for Vortex is available but it can\'t be installed automatically because '
                  + 'a necessary registry key has been removed. Please install the latest version of Vortex manually.',
              }, [
                { label: 'Close' },
                { label: 'Open Page', action: () => {
                  if (channel === 'beta') {
                    openTesting();
                  } else {
                    openStable();
                  }
                  dismiss();
                } },
              ]);
            } },
          ],
        });
        return;
      }
    }
    log('info', 'update available', {
      current: getApplication().version,
      update: info.version,
      instPath,
    });

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

      app.on('before-quit', updateWarning);

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
              app.removeListener('before-quit', updateWarning);
              autoUpdater.quitAndInstall();
            },
          },
        ],
      });
    });

  const checkNow = (channel: string) => {
    if (!state().session.base.networkConnected) {
      log('info', 'Not checking for updates because network is offline');
    }
    log('info', 'checking for vortex update');
    const didOverride = channelOverride !== undefined;
    autoUpdater.allowPrerelease = channel === 'beta';
    autoUpdater.allowDowngrade = true;
    autoUpdater.autoDownload = false;
    autoUpdater.checkForUpdates()
      .then(check => {
        log('info', 'completed update check');
        if (truthy(check.downloadPromise)) {
          check.downloadPromise.catch(err => {
            log('warn', 'Checking for update failed', err);
          });
        }

        if (!didOverride && (channelOverride !== undefined)) {
          return checkNow(channelOverride);
        }
      })
      .catch(err => {
        log('warn', 'Checking for update failed', err);
      });
  };

  ipcMain.on('check-for-updates', (event, channel: string) => {
    checkNow(channel);
  });

  ipcMain.on('set-update-channel', (event, channel) => {
    try {
      log('info', 'set channel', channel);
      if ((channel !== 'none')
          && (channelOverride === undefined)
          && (process.env.NODE_ENV !== 'development')
          && (process.env.IGNORE_UPDATES !== 'yes')) {
        checkNow(channel);
      }
    } catch (err) {
      log('warn', 'Checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
