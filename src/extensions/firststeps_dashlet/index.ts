import { IExtensionContext } from '../../types/IExtensionContext';

import Dashlet from './Dashlet';
import settingsReducer from './reducers';

function init(context: IExtensionContext): boolean {
  context.registerDashlet('ToDo', 2, 2, 200, Dashlet);

  context.registerReducer(['settings', 'firststeps'], settingsReducer);

  return true;
}

export default init;
