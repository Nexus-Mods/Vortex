import { IExtensionContext } from '../../types/IExtensionContext';

import Dashlet from './Dashlet';
import settingsReducer from './reducers';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('', 2, 5, Dashlet);

  context.registerReducer(['settings', 'firststeps'], settingsReducer);

  return true;
}

export default init;
