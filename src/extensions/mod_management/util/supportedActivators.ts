import { IModActivator } from '../types/IModActivator';
import { IStatePaths } from '../types/IStateSettings';
import resolvePath from '../util/resolvePath';

/**
 * return only those activators that are supported based on the current state
 *
 * @param {*} state
 * @returns {IModActivator[]}
 */
function supportedActivators(activators: IModActivator[], state: any): IModActivator[] {
  return activators.filter(
    (activator: IModActivator) => { return activator.isSupported(state); });
}

export default supportedActivators;
