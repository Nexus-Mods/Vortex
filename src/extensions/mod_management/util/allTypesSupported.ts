import {IDeploymentMethod, IUnavailableReason} from '../types/IDeploymentMethod';
import { getModType } from '../../gamemode_management/util/modTypeExtensions';

function allTypesSupported(activator: IDeploymentMethod, state: any,
                           gameId: string, types: string[])
                           : { errors: IUnavailableReason[], warnings: IUnavailableReason[] } {
  if (activator === undefined) {
    return { errors: [ { description: t => t('No deployment method selected') }], warnings: [] };
  }
  return types.reduce((prev, type) => {
    const reason = activator.isSupported(state, gameId, type);
    if (reason !== undefined) {
      const typeInfo = getModType(type);
      prev[(typeInfo.options.deploymentEssential === false) ? 'warnings' : 'errors'].push(reason);
    }
    return prev;
  }, { errors: [], warnings: [] });
}

export default allTypesSupported;
