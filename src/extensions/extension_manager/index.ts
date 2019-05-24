import {IExtensionContext} from '../../types/IExtensionContext';
import makeReactive from '../../util/makeReactive';

import BrowseExtensions from './BrowseExtensions';
import ExtensionManager from './ExtensionManager';
import { IExtension } from './types';
import { readExtensions } from './util';

const localState: { extensions: { [extId: string]: IExtension } } = makeReactive({
  extensions: {},
});

function init(context: IExtensionContext) {

  const updateExtensions = () => {
    readExtensions()
      .then(ext => {
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
      updateExtensions,
    }),
  });

  context.registerDialog('browse-extensions', BrowseExtensions, () => ({
    localState,
    updateExtensions,
  }));

  context.once(() => {
    updateExtensions();
  });

  return true;
}

export default init;
