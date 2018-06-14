import { IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import {} from './SettingsVortex';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Vortex', LazyComponent(() => require('./SettingsVortex')));

  return true;
}

export default init;
