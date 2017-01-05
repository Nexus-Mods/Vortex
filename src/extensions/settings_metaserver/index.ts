import { IExtensionContext } from '../../types/IExtensionContext';
import settingsReducer from './reducers';
import SettingsMetaserver from './SettingsMetaserver';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Download', SettingsMetaserver);
  context.registerReducer(['settings', 'metaserver'], settingsReducer);

  return true;
}

export default init;
