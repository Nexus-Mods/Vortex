import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import walk from '../../util/walk';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IMod } from './types/IMod';
import { IModActivator } from './types/IModActivator';

import * as Promise from 'bluebird';

/**
 * activate a list of mod
 * 
 * @export
 * @param {string} destination the game mod path
 * @param {IMod[]} mods list of mods to activate
 * @param {{ [id: string]: IProfileMod }} modState profile information about mods
 * @param {IModActivator} activator the activator to use
 * @returns {Promise<void>}
 */
export function activateMods(installPath: string,
                             destination: string,
                             mods: IMod[],
                             modState: { [id: string]: IProfileMod },
                             activator: IModActivator): Promise<void> {
  return activator.prepare(destination)
    .then(() => {
      return Promise.each(mods, (mod: IMod) => {
        if (getSafe(modState, [mod.id, 'enabled'], false)) {
          try {
            return activator.activate(installPath, destination, mod);
          } catch (err) {
            log('error', 'failed to activate mod', { err: err.message, id: mod.id });
          }
        }
      });
    })
    .then(() => {
      return activator.finalize(destination);
    });
}

/**
 * deactivate all mods installed with the specified activator
 * 
 * @export
 * @param {string} destination
 * @param {IModActivator} activator
 * @returns {Promise<void>}
 */
export function deactivateMods(installPath: string,
                               destination: string,
                               activator: IModActivator): Promise<void> {
  return activator.purge(installPath, destination);
}
