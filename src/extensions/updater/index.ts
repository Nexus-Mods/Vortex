import { IExtensionContext } from '../../types/IExtensionContext';
import setupAutoUpdate from './autoupdater';
import settingsReducer from './reducers';
import SettingsUpdate from './SettingsUpdate';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Update', SettingsUpdate);
  context.registerReducer(['settings', 'update'], settingsReducer);

  context.once(() => {
    setTimeout(() => {
      setupAutoUpdate(context.api);
    }, 5000);
  });

  return true;
}

export default init;
