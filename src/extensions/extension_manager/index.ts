import {IExtensionContext} from '../../types/IExtensionContext';

import ExtensionManager from './ExtensionManager';

function init(context: IExtensionContext) {
  context.registerMainPage('shapes', 'Extensions', ExtensionManager, {
    hotkey: 'X',
    group: 'global',
  });
  return true;
}

export default init;
