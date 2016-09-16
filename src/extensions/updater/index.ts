import { IExtensionContext } from '../../types/Extension';
import settingsReducer from './reducers';
import SettingsUpdate from './SettingsUpdate';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Update', SettingsUpdate);
  context.registerReducer(['settings', 'update'], settingsReducer);

  return true;
}

export default init;
