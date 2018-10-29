import { IExtensionContext } from '../../types/IExtensionContext';
import automationReducer from './reducers/automation';
import settingsReducer from './reducers/interface';
import SettingsInterface from './SettingsInterface';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Interface', SettingsInterface, undefined, undefined, 50);
  context.registerReducer(['settings', 'interface'], settingsReducer);
  context.registerReducer(['settings', 'automation'], automationReducer);

  return true;
}

export default init;
