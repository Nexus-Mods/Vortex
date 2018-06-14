import { IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import settingsReducer from './reducers';
import {} from './SettingsMetaserver';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Download', LazyComponent(() => require('./SettingsMetaserver')));
  context.registerReducer(['settings', 'metaserver'], settingsReducer);

  return true;
}

export default init;
