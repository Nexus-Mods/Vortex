import { IExtensionApi } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IDeployedFile, IDeploymentMethod } from './types/IDeploymentMethod';
import { IMod } from './types/IMod';
import renderModName from './util/modName';

import { BACKUP_TAG } from './LinkingDeployment';
import { MERGED_PATH } from './modMerging';

import * as Promise from 'bluebird';
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
function deployMods(api: IExtensionApi,
                    gameId: string,
                    installationPath: string,
                    destinationPath: string,
                    mods: IMod[],
                    method: IDeploymentMethod,
                    lastActivation: IDeployedFile[],
                    typeId: string,
                    merged: Set<string>,
                    subDir: (mod: IMod) => string,
                    progressCB?: (name: string, progress: number) => void,
                   ): Promise<IDeployedFile[]> {
  if (typeof (destinationPath) !== 'string') {
    // TODO: This is for debugging a specific problem and can probably removed afterwards
    return Promise.reject(new Error(
      `Invalid mod path for game "${gameId}" type "${typeId}": `
      + `"${require('util').inspect(destinationPath)}"`));
  }
  return method.prepare(destinationPath, true, lastActivation)
    .then(() => Promise.each(mods, (mod, idx, length) => {
      try {
        if (progressCB !== undefined) {
          progressCB(renderModName(mod), Math.round((idx * 50) / length));
        }
        return method.activate(path.join(installationPath, mod.installationPath),
                               mod.installationPath, subDir(mod), merged);
      } catch (err) {
        log('error', 'failed to deploy mod', {err: err.message, id: mod.id});
      }
    }))
    .then(() => {
      const mergePath = truthy(typeId)
        ? MERGED_PATH + '.' + typeId
        : MERGED_PATH;
      return method.activate(path.join(installationPath, mergePath),
                             mergePath, '', new Set<string>());
    })
    .then(() => {
      const cb = progressCB === undefined
        ? undefined
        : (files: number, total: number) =>
            progressCB(`${files}/${total} files`, 50 + (files * 50) / total);
      return method.finalize(gameId, destinationPath, installationPath, cb);
    });
}

export default deployMods;
