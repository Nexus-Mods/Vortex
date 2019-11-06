import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import makeReactive from '../../util/makeReactive';

import { setAvailableExtensions, setExtensionsUpdate, setInstalledExtensions } from './actions';
import BrowseExtensions from './BrowseExtensions';
import ExtensionManager from './ExtensionManager';
import sessionReducer from './reducers';
import { IAvailableExtension, IExtensionDownloadInfo } from './types';
import { downloadAndInstallExtension, fetchAvailableExtensions, readExtensions } from './util';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as _ from 'lodash';

interface ILocalState {
  reloadNecessary: boolean;
}

const localState: ILocalState = makeReactive({
  reloadNecessary: false,
});

function checkForUpdates(api: IExtensionApi) {
  const state: IState = api.store.getState();
  const { available, installed }  = state.session.extensions;

  const updateable: IAvailableExtension[] = Object.values(installed).reduce((prev, ext) => {
    if (ext.modId === undefined) {
      return prev;
    }

    const current = available.find(iter => iter.modId === ext.modId);
    if (current === undefined) {
      return prev;
    }

    if (current.version === ext.version) {
      return prev;
    }

    prev.push(current);

    return prev;
  }, []);

  if (updateable.length === 0) {
    return Promise.resolve();
  }

  api.sendNotification({
    id: 'extension-updates',
    type: 'info',
    message: '{{ count }} extensions will be updated',
    replace: { count: updateable.length },
  });

  return Promise.map(updateable, ext => downloadAndInstallExtension(api, ext))
    .then(() => {
      localState.reloadNecessary = true;
      api.sendNotification({
        id: 'extension-updates',
        type: 'success',
        message: 'Extensions update, please restart to apply them',
        actions: [
          {
            title: 'Restart now', action: () => {
              remote.app.relaunch();
              remote.app.exit(0);
            },
          },
        ],
      });
    });
}

function updateAvailableExtensions(api: IExtensionApi, force: boolean = false) {
  return fetchAvailableExtensions(true, force)
    .catch(err => {
      api.showErrorNotification('Failed to fetch available extensions', err);
      return { time: null, extensions: [] };
    })
    .then(({ time, extensions }: { time: Date, extensions: IAvailableExtension[] }) => {
      api.store.dispatch(setExtensionsUpdate(time.getTime()));
      api.store.dispatch(setAvailableExtensions(extensions));
      return checkForUpdates(api);
    });
}

function init(context: IExtensionContext) {
  const updateInstalledExtensions = (initial: boolean) => {
    readExtensions(true)
      .then(ext => {
        const api = context.api;
        const state: IState = api.store.getState();
        if (!initial && !_.isEqual(state.session.extensions.installed, ext)) {
          localState.reloadNecessary = true;
        }
        api.store.dispatch(setInstalledExtensions(ext));
      })
      .catch(err => {
        // this probably only occurs if the user deletes the plugins directory after start
        context.api.showErrorNotification('Failed to read extension directory', err, {
          allowReport: false,
        });
      });
  };

  context.registerMainPage('extensions', 'Extensions', ExtensionManager, {
    hotkey: 'X',
    group: 'global',
    visible: () => context.api.store.getState().settings.interface.advanced,
    props: () => ({
      localState,
      updateExtensions: updateInstalledExtensions,
    }),
  });

  const forceUpdateExtensions = () => {
    updateAvailableExtensions(context.api, true);
  };

  context.registerDialog('browse-extensions', BrowseExtensions, () => ({
    localState,
    updateExtensions: updateInstalledExtensions,
    onRefreshExtensions: forceUpdateExtensions,
  }));

  context.registerReducer(['session', 'extensions'], sessionReducer);

  context.once(() => {
    updateInstalledExtensions(true);
    updateAvailableExtensions(context.api);
    context.api.onAsync('download-extension', (ext: IExtensionDownloadInfo) =>
      downloadAndInstallExtension(context.api, ext)
        .then(() => updateInstalledExtensions(false)));
  });

  return true;
}

export default init;
