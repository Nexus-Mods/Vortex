import {IModActivator} from '../types/IModActivator';

function allTypesSupported(activator: IModActivator, state: any,
                           gameId: string, types: string[]): string {
  let reason: string;
  types.find(type => {
    reason = activator.isSupported(state, gameId, type);
    return reason !== undefined;
  });
  return reason;
}

export default allTypesSupported;
