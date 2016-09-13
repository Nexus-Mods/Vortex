import { IExtensionContext } from '../../types/Extension';
import settingsReducer from './reducers';
import SettingsInterface from './SettingsInterface';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Interface', SettingsInterface);
  context.registerReducer(['settings', 'interface'], settingsReducer);

  return true;
}

export default init;
