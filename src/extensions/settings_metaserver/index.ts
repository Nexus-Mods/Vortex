import { IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import settingsReducer from './reducers';
import {} from './SettingsMetaserver';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'metaserver'], settingsReducer);
  context.registerSettings('Download', LazyComponent(() => require('./SettingsMetaserver')));

  return true;
}

export default init;
