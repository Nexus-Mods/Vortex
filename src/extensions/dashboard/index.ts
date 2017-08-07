import { IExtensionContext } from '../../types/IExtensionContext';
import Dashboard from './views/Dashboard';

import settingsReducer from './reducer';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'interface'], settingsReducer);
  context.registerMainPage('dashboard', 'Dashboard', Dashboard, {
    hotkey: '1',
    group: 'global',
  });

  return true;
}

export default init;
