import { IExtensionContext } from '../../types/IExtensionContext';
import Dashboard from './views/Dashboard';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('th', 'Welcome', Dashboard, {
    hotkey: '1',
  });

  return true;
}

export default init;
