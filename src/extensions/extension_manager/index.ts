import {IExtensionContext, IExtensionApi} from '../../types/IExtensionContext';
import makeReactive from '../../util/makeReactive';

import BrowseExtensions from './BrowseExtensions';
import ExtensionManager from './ExtensionManager';
import { IExtension, IExtensionDownloadInfo } from './types';
import { readExtensions, fetchAvailableExtensions, downloadExtension } from './util';
import sessionReducer from './reducers';

import * as _ from 'lodash';
import { setAvailableExtensions } from './actions';

interface ILocalState {
  extensions: { [extId: string]: IExtension };
  reloadNecessary: boolean;
}

const localState: ILocalState = makeReactive({
  reloadNecessary: false,
  extensions: {},
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
        if (!initial && !_.isEqual(localState.extensions, ext)) {
          localState.reloadNecessary = true;
        }
        localState.extensions = ext;
      })
      .catch(err => {
        // this probably only occurs if the user deletes the plugins directory after start
        context.api.showErrorNotification('Failed to read extension directory', err, {
          allowReport: false,
        });
      });
  }

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
      downloadExtension(context.api, ext));
  });

  return true;
}

export default init;
