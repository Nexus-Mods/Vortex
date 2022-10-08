import { IExtensionApi } from '../../types/IExtensionContext';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import { truthy } from '../../util/util';

import { IDeployedFile, IDeploymentMethod } from './types/IDeploymentMethod';
import { IMod } from './types/IMod';
import renderModName from './util/modName';

import { MERGED_PATH } from './modMerging';

import Bluebird from 'bluebird';
import * as path from 'path';
import { UserCanceled } from '../../util/api';

function ensureWritable(api: IExtensionApi, modPath: string): Bluebird<void> {
  return fs.ensureDirWritableAsync(modPath, () => api.showDialog('question', 'Access Denied', {
    text: 'The mod folder for this game is not writable to your user account.\n'
      + 'If you have admin rights on this system, Vortex can change the permissions '
      + 'to allow it write access.',
  }, [
      { label: 'Cancel' },
      { label: 'Allow access' },
    ]).then(result => (result.action === 'Cancel')
      ? Bluebird.reject(new UserCanceled())
      : Bluebird.resolve()));
}

/**
 * activate a list of mod
 *
 * @export
 * @param {string} installationPath the path where mods are installed
 * @param {string} destinationPath the game mod path
 * @param {IMod[]} mods list of mods to activate (sorted from lowest to highest
 * priority)
 * @param {IDeploymentMethod} method the activator to use
 * @returns {Bluebird<void>}
 */
function deployMods(api: IExtensionApi,
                    gameId: string,
                    installationPath: string,
                    destinationPath: string,
                    mods: IMod[],
                    method: IDeploymentMethod,
                    lastActivation: IDeployedFile[],
                    typeId: string,
                    skipFiles: Set<string>,
                    subDir: (mod: IMod) => string,
                    progressCB?: (name: string, progress: number) => void,
                   ): Bluebird<IDeployedFile[]> {
  if (!truthy(destinationPath)) {
    return Bluebird.resolve([]);
  }

  log('info', 'deploying', { gameId, typeId, installationPath, destinationPath });

  let normalize: Normalize;
  return ensureWritable(api, destinationPath)
    .then(() => getNormalizeFunc(destinationPath))
    .then(norm => {
      normalize = norm;
      return method.prepare(destinationPath, true, lastActivation, norm);
    })
    .then(() => Bluebird.each(mods, (mod, idx, length) => {
      try {
        if (progressCB !== undefined) {
          progressCB(renderModName(mod), Math.round((idx * 50) / length));
        }
        return method.activate(path.join(installationPath, mod.installationPath),
                               mod.installationPath, subDir(mod), skipFiles)
          .then(() => {
            if (mod.fileOverrides !== undefined) {
              mod.fileOverrides.forEach(file => skipFiles.add(normalize(file)));
            }
          });
      } catch (err) {
        log('error', 'failed to deploy mod', {err: err.message, id: mod.id});
      }
    }))
    .then(() => {
      const mergePath = truthy(typeId)
        ? MERGED_PATH + '.' + typeId
        : MERGED_PATH;

      return method.activate(path.join(installationPath, mergePath),
                             mergePath, subDir(null), new Set<string>());
    })
    .tapCatch(() => {
      if (method.cancel !== undefined) {
        method.cancel(gameId, destinationPath, installationPath);
      }
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
