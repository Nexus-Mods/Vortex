import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import makeReactive from '../../util/makeReactive';

import BrowseExtensions from './BrowseExtensions';
import ExtensionManager from './ExtensionManager';
import sessionReducer from './reducers';
import { IExtensionDownloadInfo } from './types';
import { downloadAndInstallExtension, fetchAvailableExtensions, readExtensions } from './util';

import * as _ from 'lodash';
import { setAvailableExtensions, setInstalledExtensions } from './actions';

interface ILocalState {
  reloadNecessary: boolean;
}

const localState: ILocalState = makeReactive({
  reloadNecessary: false,
});

function updateAvailableExtensions(api: IExtensionApi) {
  return fetchAvailableExtensions(true)
    .catch(err => {
      api.showErrorNotification('Failed to fetch available extensions', err);
      return [];
    })
    .then(extensions => {
      api.store.dispatch(setAvailableExtensions(extensions));
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

  context.registerDialog('browse-extensions', BrowseExtensions, () => ({
    localState,
    updateExtensions: updateInstalledExtensions,
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
