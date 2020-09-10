import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { IModType } from '../../gamemode_management/types/IModType';
import { getModType } from '../../gamemode_management/util/modTypeExtensions';

import {IDeploymentMethod, IUnavailableReason} from '../types/IDeploymentMethod';

import * as _ from 'lodash';

function allTypesSupported(activator: IDeploymentMethod, state: any,
                           gameId: string, types: string[])
                           : { errors: IUnavailableReason[], warnings: IUnavailableReason[] } {
  if (activator === undefined) {
    return { errors: [ { description: t => t('No deployment method selected') }], warnings: [] };
  }
  return types.reduce((prev, type) => {
    const reason = activator.isSupported(state, gameId, type);
    if (reason !== undefined) {
      if (!_.isFunction(reason.description)) {
        log('error', 'deployment unavailable with no description', {
          gameId, method: activator.id, reason: JSON.stringify(reason),
        });
        reason.description = () =>
          '<Missing description, please report this and include a log file>';
      }
      const typeInfo: IModType = getModType(type);
      const { deploymentEssential } = getSafe(typeInfo, ['options'], { deploymentEssential: true });
      prev[(deploymentEssential === false) ? 'warnings' : 'errors'].push(reason);
    }
    return prev;
  }, { errors: [], warnings: [] });
}

export default allTypesSupported;
