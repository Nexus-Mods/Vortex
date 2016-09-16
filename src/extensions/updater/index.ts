import { IExtensionContext } from '../../types/IExtensionContext';
import setupAutoUpdate from './autoupdater';
import settingsReducer from './reducers';
import SettingsUpdate from './SettingsUpdate';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Update', SettingsUpdate);
  context.registerReducer(['settings', 'update'], settingsReducer);

  context.once(() => {
    setupAutoUpdate(context.api);
  });

  return true;
}

export default init;
