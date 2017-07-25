import { IExtensionContext } from '../../types/IExtensionContext';
import Dashboard from './views/Dashboard';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('th', 'Dashboard', Dashboard, {
    hotkey: '1',
    group: 'global',
  });

  return true;
}

export default init;
