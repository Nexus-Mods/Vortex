import { IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import {} from './SettingsVortex';

function init(context: IExtensionContext): boolean {
  context.registerSettings('Vortex', LazyComponent('./SettingsVortex', __dirname));

  return true;
}

export default init;
