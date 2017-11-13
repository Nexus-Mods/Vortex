import { IExtensionContext } from '../../types/IExtensionContext';
import Dashboard from './views/Dashboard';

import settingsReducer from './reducer';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'interface'], settingsReducer);
  context.registerMainPage('dashboard', 'Dashboard', Dashboard, {
    priority: 0,
    hotkey: '1',
    group: 'dashboard',
  });

  return true;
}

export default init;
