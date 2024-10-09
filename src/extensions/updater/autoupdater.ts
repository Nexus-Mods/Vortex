import { setUpdateChannel, showDialog } from '../../actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState, UpdateChannel } from '../../types/IState';
import { getVisibleWindow, UserCanceled } from '../../util/api';
import { log } from '../../util/log';
import opn from '../../util/opn';
import { truthy } from '../../util/util';

import { NEXUS_BASE_URL } from '../nexus_integration/constants';

import {app as appIn, dialog as dialogIn, ipcMain} from 'electron';
import {autoUpdater as AUType, CancellationToken, UpdateInfo} from 'electron-updater';
import * as semver from 'semver';
import uuidv5 from 'uuid/v5';
import { RegGetValue } from 'winapi-bindings';
import { getApplication } from '../../util/application';

const CHECKING_FOR_UPDATES_ID = 'vortex-checking-updates-notification';
const UPDATE_AVAILABLE_ID = 'vortex-update-available-notification';
const FORCED_SWITCH_TO_BETA_ID = 'switched-to-beta-channel';


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

  // if dev, don't do this

  dialog.showMessageBoxSync(getVisibleWindow(), {
    type: 'info',
    title: 'Vortex critical update',
    message: 'A critical update has been downloaded and needs installing. ' +
            'Please do not turn off your computer until it\'s done. ' + 
            'If the installation process is interrupted, Vortex may not work correctly.',
    buttons: ['Continue'],
    noLink: true,
  });
}

function setupAutoUpdate(api: IExtensionApi) {
  const autoUpdater: typeof AUType = require('electron-updater').autoUpdater;

  const state: () => IState = () => api.store.getState();
  let notified: boolean = false;
  let channelOverride: UpdateChannel;
  let cancellationToken: CancellationToken;
  let updateChannel = state().settings.update.channel;
  const currentVersion = semver.parse(getApplication().version);
  

  /*
  if (process.env.IS_PREVIEW_BUILD === 'true') {
    log('info', 'forcing update channel for preview builds so that we don\'t automatically downgrade');
    api.store.dispatch(setUpdateChannel('next'));
  } else if (state().settings.update.channel === 'next') {
    api.store.dispatch(setUpdateChannel('beta'));
  }*/

  // a little bit of a hack here to force the update channel to be beta IN CASE someone is on next.
  // we don't want 'next' to be an update channel, only that IS_PREVIEW_BUILD sets what repo to check against
  if (updateChannel === 'next') {
    api.store.dispatch(setUpdateChannel('beta'));
  }

  // if we are running a prerelease build, we want to force the update channel to be beta 
  if(currentVersion.prerelease.length > 0 && updateChannel === 'stable') {
    log('info', 'current version is a pre-release and current channel is stable, setting update channel to beta');

    api.store.dispatch(setUpdateChannel('beta'));
    api.sendNotification({
      id: FORCED_SWITCH_TO_BETA_ID,
      type: 'info',
      message: 'You are running a beta version of Vortex so auto update settings have been '
             + 'changed to keep you up-to-date with current betas.',
    });
  }

  log('info', 'setupAutoUpdate complete');

  const queryUpdate = (updateInfo: UpdateInfo): Promise<void> => {
    return new Promise<void>((resolve, reject) => {

      log('debug', 'Querying update', { tag: updateInfo["tag"], version: updateInfo["version"] })

      if (semver.satisfies(updateInfo.version, `~${autoUpdater.currentVersion.version}`, { includePrerelease: true })) {
        log('info', `${updateInfo.version} is a patch update from ${autoUpdater.currentVersion.version} so we need to force download`);
        // if it's a patch release (1.2.x) then we don't need to ask to download
        return resolve();
      }

      // if it's a minor release (1.x.0) then we need to ask to download
      
      // log('info', `${updateInfo.version} is not a patch update from ${autoUpdater.currentVersion.version} so we need to ask to download`);


      // below is needed to make sure we only show release notes less than or equal to the current version
      let filteredReleaseNotes = updateInfo.releaseNotes;
      
      if(typeof filteredReleaseNotes !== 'string') {
        filteredReleaseNotes = filteredReleaseNotes.filter(release => {
          {
            const comparisonResult = semver.compare(release.version, updateInfo.version);
            return comparisonResult === 0 || comparisonResult === -1;
          }
        });        
      }

      notified = true;     



      // is update version greater than our current version?

      if (semver.satisfies(updateInfo.version, `>${autoUpdater.currentVersion.version}`, { includePrerelease: true })) {
        
        // normal upgrade

        log('info', `${updateInfo.version} is greater than ${autoUpdater.currentVersion.version} so this is an upgrade.`);

        api.sendNotification({
          id: UPDATE_AVAILABLE_ID,
          type: 'info',
          title: 'Update available',
          message: `${updateInfo.version} is available.`,
          //noDismiss: true,
          actions: [          
            { title: 'View Update', action: dismiss => {
              return api.showDialog('info', `What\'s New in ${updateInfo.version}`, {
                htmlText: typeof filteredReleaseNotes === 'string' ? filteredReleaseNotes : filteredReleaseNotes.map(release =>                
                  `<div class="changelog-dialog-release">
                    <h4>${release.version} </h4>
                    ${release.note}
                  </div>`
                  ).join(''),
              }, [
                { label: 'Close' , action: () => log('debug', 'User closed dialog')},
                /*{ label: 'Ignore', action: () => {                  
                  log('debug', 'User ignored update')
                  return reject(new UserCanceled())
                }},*/
                { label: 'Download', action: () => {                                
                  log('debug', 'User downloading update')
                  return resolve()
                } }
              ],
              'new-update-changelog-dialog');
            } },/*
            {
              title: 'Ignore',
              action: dismiss => {
                log('debug', 'User ignored update')
                dismiss();
                reject(new UserCanceled());
              },
            },*/
          ],
        })        

      } else {

        // downgrade?
            
        log('info', `${updateInfo.version} is less than ${autoUpdater.currentVersion.version} so this is a downgrade.`);

        api.sendNotification({
          id: UPDATE_AVAILABLE_ID,
          type: 'warning',
          title: 'Downgrade available',
          message: `${updateInfo.version} is available.`,
          noDismiss: true,
          actions: [          
            { title: 'More Info', action: () => {
              api.showDialog('info', `Downgrade warning`, {
                text: `Your installed version of Vortex (${autoUpdater.currentVersion.version}) is newer than the one available online (${updateInfo.version}). This could of been caused by installing a pre release version and then swapping back to stable updates. This is not recommended and we suggest going back to the beta update channel.

Patch version downgrades (i.e. 1.9.13 downgrading to 1.9.12) are mostly harmless as Vortex's state information would have not changed extensively but Minor version changes (i.e. 1.10.x downgrading to 1.9.x) are usually significant and may alter your state beyond the previous versions capabilities. In some cases this can ruin your modding environment and require a new mods setup.
                    
Are you sure you want to downgrade?`,
              }, [
                { label: 'Close' },
                //{ label: 'Ignore', action: () => reject(new UserCanceled()) },
                { label: 'Downgrade', action: () => resolve() }
              ],
              'new-update-changelog-dialog');
            } },
            /*{
              title: 'Ignore',
              action: dismiss => {
                log('debug', 'User ignored downgrade')
                dismiss();
                reject(new UserCanceled());
              },
            },*/
          ],
        }); 
        
        
      }  
    });    
  };

  autoUpdater.on('error', (err) => {

    // need to remove notifications?!
    api.dismissNotification(CHECKING_FOR_UPDATES_ID);

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
               || (err.message === 'net::ERR_NAME_NOT_RESOLVED')
               || (err.message === 'net::ERR_INTERNET_DISCONNECTED')) {
      api.showErrorNotification(
        'Checking for update failed',
        'This was probably a temporary network problem, please try again later.',
        { allowReport: false });
    } else {
      api.showErrorNotification('Checking for update failed', err, { allowReport: false });
    }
  });

  autoUpdater.on('update-not-available', () => {
    
    log('info', `Installed version is up to date using the ${updateChannel} channel.`);

    api.sendNotification({
      id: CHECKING_FOR_UPDATES_ID,
      type: 'success',
      message: 'Vortex is up to date',
      displayMS: 3000
    });

    /*
    if (channelOverride !== undefined) {
      log('info', 'installed version seems to be a non-stable release, switching update channel');
      api.store.dispatch(setUpdateChannel(channelOverride));
      api.sendNotification({
        id: 'switched-to-beta-channel',
        type: 'info',
        message: 'You are running a beta version of Vortex so auto update settings have been '
               + 'changed to keep you up-to-date with current betas.',
      });
    }*/
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
      
    // need to remove notifications?!
    api.dismissNotification(CHECKING_FOR_UPDATES_ID);

    log('info', 'found update available', {
      version: info.version,
      files: info.files,
      releaseName: info.releaseName,
      releaseDate: info.releaseDate
    });

    const installedVersion = semver.parse(getApplication().version);
    const version = semver.parse(info.version);

    const channel = channelOverride ?? api.getState().settings.update.channel;

    if ((channel === 'stable')
      && (channelOverride === undefined)
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

    queryUpdate(info)
      .then(() => autoUpdater.downloadUpdate(cancellationToken)
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
        id: UPDATE_AVAILABLE_ID,
        type: 'activity',
        message: 'Downloading update',
        progress: progress.percent,
        actions: [
          {
            title: 'Cancel',
            action: () => {
              cancellationToken?.cancel();
              api.suppressNotification(UPDATE_AVAILABLE_ID, true);
              // check again in case we need to download again
              checkNow(updateChannel);
            },
          },
        ],
      });
    }
  });

  autoUpdater.on('update-downloaded',
    (updateInfo: UpdateInfo) => {

      log('info', 'update downloaded');

      // sets up warning and autoUpdater to install on quit only if not in dev mode
      if (process.env.NODE_ENV !== 'development') {
        autoUpdater.autoInstallOnAppQuit = true;
        app.on('before-quit', updateWarning);
        log('info', 'auto install on quit is set');
      }

      // below is needed to make sure we only show release notes less than or equal to the current version
      let filteredReleaseNotes = updateInfo.releaseNotes;
      
      if(typeof filteredReleaseNotes === 'string') {
        log('info', 'release notes are a string');
      } else {
        log('info', 'release notes are an array'); 

        filteredReleaseNotes = filteredReleaseNotes.filter(release => {
          {
            const comparisonResult = semver.compare(release.version, updateInfo.version);
            return comparisonResult === 0 || comparisonResult === -1;
          }
        });        
      }

      api.sendNotification({
        id: UPDATE_AVAILABLE_ID,
        type: 'success',
        message: 'Update downloaded',
        noDismiss: true,
        actions: [
          {
            title: 'What\'s New',
            action: () => {
              api.store.dispatch(showDialog('info', `What\'s New in ${updateInfo.version}`, {
                htmlText: typeof filteredReleaseNotes === 'string' ? filteredReleaseNotes : filteredReleaseNotes.map(release =>                
                  `<div class="changelog-dialog-release">
                    <h4>${release.version} </h4>
                    ${release.note}
                  </div>`
                  ).join(''),
              }, [
                  { label: 'Close' },
                  { label: 'Restart & Install', action: handleRestartInstall }
                ],
                'new-update-changelog-dialog'
              ));
            },
          },
          {
            title: 'Restart & Install',
            action: handleRestartInstall,
          },
        ],
      });
    });

    /**
     * Handles the restart and install action
     */
    const handleRestartInstall = () => {

      if (process.env.NODE_ENV !== 'development') {

          // only needed if the user force closes and doesn't use this notification button
          app.removeListener('before-quit', updateWarning);

          // we only want to quit and install if we are not running a dev build
          autoUpdater.quitAndInstall();

        } else {

          // show a dialog to say that we are not going to install the update
          api.store.dispatch(showDialog('info', 'This update won\'t be installed', {
            text: 'This update won\'t be installed as this is a development build and have gone as far as we can down the update route.',
          }, [
            { label: 'Close' },
          ]));

        }

      
    }

  const checkNow = (channel: string, manual: boolean = false) => {

    if (!state().session.base.networkConnected) {
      log('info', 'Not checking for updates because network is offline');    }

    const isPreviewBuild = process.env.IS_PREVIEW_BUILD === 'true' ?? false

    log('info', 'Checking for vortex update:', channel);
    const didOverride = channelOverride !== undefined;
    autoUpdater.allowPrerelease = channel !== 'stable';    

    // if we are on stable channel, and the latest non-prerelease is less than what we have (suggesting we have installed a pre-release and then switched to stable)
    // we have the potential to need to downgrade and that the latest stable is less than what we have

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Nexus-Mods',
      repo: isPreviewBuild ? 'Vortex-Staging' : 'Vortex',
      private: false,
      publisherName: [        
        'Black Tree Gaming Ltd',
        'Black Tree Gaming Limited'
      ],
    });

    autoUpdater.allowDowngrade = true; // at this point we don't care about downgrades, not really checking I don't think
    autoUpdater.autoDownload = false; // we never want to autodownload, we tell it to download if patch release, or ask user first if not
    autoUpdater.fullChangelog = true; // so we get to show older changelogs other than the release we are downloading                // we want to stop the updater from trying to install as we are running a dev build     
    autoUpdater.autoInstallOnAppQuit = false; // default to false, we set to true if we want to install on quit and not a dev build

    log('info', 'update config is ', {
      provider: 'github',
      owner: 'Nexus-Mods',
      repo: isPreviewBuild ? 'Vortex-Staging' : 'Vortex',
      allowPrerelease: autoUpdater.allowPrerelease
    });

    // add notificaiton to show checking for updates only if manual check
    if(manual) {
      api.sendNotification({
        id: CHECKING_FOR_UPDATES_ID,
        type: 'activity',
        message: 'Checking for updates...'
      });
    }
      
    autoUpdater.checkForUpdates()
      .then(check => {
        log('info', 'completed update check');

        // set token for this update
        cancellationToken = check.cancellationToken;

        // do a check here for if a regular type (properly installed, not dev or epic or whatever)
        // then that's the only time that we want to do the auto download
        if (api.getState().app.installType === 'regular') {

          if (truthy(check.downloadPromise)) {
            check.downloadPromise.catch(err => {
              log('warn', 'Checking for update failed', err);
            });
          }
        }        

        if (!didOverride && (channelOverride !== undefined)) {
          return checkNow(channelOverride);
        }
      })
      .catch(err => {
        log('warn', 'Checking for update failed', err);
      });
  };

  ipcMain.on('check-for-updates', (event, channel: string, manual: boolean) => {

    checkNow(channel, manual);
  });

  ipcMain.on('set-update-channel', (event, channel: UpdateChannel, manual: boolean) => {
    try {
      log('info', 'set channel', { channel, manual, channelOverride });

      // need to remove notifications?!
      api.suppressNotification(UPDATE_AVAILABLE_ID, true);

      // cancel download in case?
      cancellationToken?.cancel();

      if(channel !== 'beta') 
        // remove just in case it might be on
        api.suppressNotification(FORCED_SWITCH_TO_BETA_ID, true);
      
      if ((channel !== 'none')     
        && ((channelOverride === undefined) || manual)    
        //&& (process.env.NODE_ENV !== 'development') 
        && (process.env.IGNORE_UPDATES !== 'yes')) {
        
        if (manual) {
          channelOverride = channel;
        }
        
        updateChannel = channel;

        checkNow(channel);
      }
    } catch (err) {
      log('warn', 'Checking for update failed', err);
      return;
    }
  });
}

export default setupAutoUpdate;
