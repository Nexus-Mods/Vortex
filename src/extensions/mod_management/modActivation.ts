import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IMod } from './types/IMod';
import { IDeployedFile, IModActivator } from './types/IModActivator';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

/**
 * activate a list of mod
 *
 * @export
 * @param {string} installPath the path where mods are installed
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
                             activator: IModActivator,
                             lastActivation: IDeployedFile[]): Promise<IDeployedFile[]> {
  return activator.prepare(destination, true, lastActivation)
      .then(() => Promise.each(
                mods,
                mod => {
                  if (getSafe(modState, [mod.id, 'enabled'], false)) {
                    try {
                      return activator.activate(installPath, destination, mod);
                    } catch (err) {
                      log('error', 'failed to deploy mod',
                          {err: err.message, id: mod.id});
                    }
                  }
                }))
      .then(() => activator.finalize(destination));
}
