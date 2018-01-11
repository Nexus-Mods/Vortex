import { IExtensionApi } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IDeployedFile, IDeploymentMethod } from './types/IDeploymentMethod';
import { IMod } from './types/IMod';
import renderModName from './util/modName';

import { BACKUP_TAG } from './LinkingDeployment';
import { MERGED_PATH } from './modMerging';

import * as Promise from 'bluebird';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * activate a list of mod
 *
 * @export
 * @param {string} installationPath the path where mods are installed
 * @param {string} destinationPath the game mod path
 * @param {IMod[]} mods list of mods to activate (sorted from lowest to highest
 * priority)
 * @param {IDeploymentMethod} method the activator to use
 * @returns {Promise<void>}
 */
export function activateMods(api: IExtensionApi,
                             gameId: string,
                             installationPath: string,
                             destinationPath: string,
                             mods: IMod[],
                             method: IDeploymentMethod,
                             lastActivation: IDeployedFile[],
                             typeId: string,
                             merged: Set<string>,
                             progressCB?: (name: string, progress: number) => void,
                            ): Promise<IDeployedFile[]> {
  return method.prepare(destinationPath, true, lastActivation)
    .then(() => Promise.each(mods, (mod, idx, length) => {
      try {
        if (progressCB !== undefined) {
          progressCB(renderModName(mod), Math.round((idx * 50) / length));
        }
        return method.activate(path.join(installationPath, mod.installationPath),
                              mod.installationPath, destinationPath, merged);
      } catch (err) {
        log('error', 'failed to deploy mod', {err: err.message, id: mod.id});
      }
    }))
    .then(() => method.activate(path.join(installationPath, MERGED_PATH) + '.' + typeId,
                                MERGED_PATH + '.' + typeId, destinationPath, new Set<string>()))
    .then(() => {
      const cb = progressCB === undefined
        ? undefined
        : (files: number, total: number) =>
            progressCB(`${files}/${total} files`, 50 + (files * 50) / total);
      return method.finalize(gameId, destinationPath, installationPath, cb);
    });
}
