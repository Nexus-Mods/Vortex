import getAttr from '../../util/getAttr';
import { log } from '../../util/log';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IMod } from './types/IMod';
import { IModActivator } from './types/IModActivator';

import * as Promise from 'bluebird';

export function activateMods(destination: string,
                             mods: IMod[],
                             modState: { [id: string]: IProfileMod },
                             activator: IModActivator): Promise<void> {
  return activator.prepare(destination)
    .then(() => {
      return Promise.each(mods, (mod: IMod) => {
        if (getAttr(modState, mod.id, { enabled: false }).enabled) {
          try {
            return activator.activate(destination, mod);
          } catch (err) {
            log('error', 'failed to activate mod', { err: err.message, id: mod.id });
          }
        }
      });
    })
    .then(() => {
      activator.finalize(destination);
    });
}

export function deactivateMods(destination: string,
                               activator: IModActivator): Promise<void> {
  return activator.deactivate(destination);
}
