import {IDeploymentMethod, IUnavailableReason} from '../types/IDeploymentMethod';

function allTypesSupported(activator: IDeploymentMethod, state: any,
                           gameId: string, types: string[]): IUnavailableReason {
  if (activator === undefined) {
    return { description: t => t('No deployment method selected') };
  }
  let reason: IUnavailableReason;
  types.find(type => {
    reason = activator.isSupported(state, gameId, type);
    return reason !== undefined;
  });
  return reason;
}

export default allTypesSupported;
