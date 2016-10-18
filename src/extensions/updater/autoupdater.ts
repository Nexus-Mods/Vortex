import { IExtensionApi } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import i18next = require('i18next');

import { remote } from 'electron';

function setChannel(channel: string,
                    showErrorNotification: (message: string, detail: string) => void) {
  const autoUpdater = remote.autoUpdater;

  // const url = `http://localhost:56001/download/channel/${channel}/win`;
  // TODO: This isn't actually using the channel :( nuts doesn't implement this yet
  const url = `http://localhost:56000/update/win32/${remote.app.getVersion()}`;

  autoUpdater.setFeedURL(url);
  autoUpdater.on('error', (err) => {
    showErrorNotification('checking for update failed', err.message);
    // log('error', 'failed to check for updates', { err });
  });
  log('info', 'feed url', url);
  try {
    autoUpdater.checkForUpdates();
  } catch (e) {
    showErrorNotification('checking for update failed', e.message);
    return;
  }
}

function setupAutoUpdate(api: IExtensionApi) {
  if (remote === undefined) {
    log('error', 'auto updater expected to be run in renderer thread');
    return;
  }

  const autoUpdater = remote.autoUpdater;

  let channel: string = api.store.getState().settings.update.channel;
  setChannel(channel, api.showErrorNotification);

  api.store.subscribe(() => {
    const newChannel = api.store.getState().settings.update.channel;
    if (channel !== newChannel) {
      channel = newChannel;
      setChannel(newChannel, api.showErrorNotification);
    }
  });

  autoUpdater.on('update-available', () => {
    log('info', 'update available');
  });
  autoUpdater.on('update-not-available', () => {
    log('info', 'no update available');
  });
  autoUpdater.on('update-downloaded',
                 (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) => {
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
