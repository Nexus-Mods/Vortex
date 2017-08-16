import {IExtensionContext} from '../../types/IExtensionContext';
import {IState} from '../../types/IState';

import ExtensionManager from './ExtensionManager';

function init(context: IExtensionContext) {
  context.registerMainPage('shapes', 'Extensions', ExtensionManager, {
    hotkey: 'X',
    group: 'global',
    visible: () => context.api.store.getState().settings.interface.advanced,
  });
  return true;
}

export default init;
