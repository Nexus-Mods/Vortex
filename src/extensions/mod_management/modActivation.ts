import {IExtensionApi} from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import getFileList from '../../util/getFileList';
import { log } from '../../util/log';
import { getSafe } from '../../util/storeHelper';
import { setdefault } from '../../util/util';
import walk from '../../util/walk';

import { IProfileMod } from '../profile_management/types/IProfile';

import { IDeployedFile, IDeploymentMethod } from './types/IDeploymentMethod';
import { IMod } from './types/IMod';

import { BACKUP_TAG } from './LinkingDeployment';

import * as Promise from 'bluebird';
import * as crypto from 'crypto';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

const MERGED_PATH = '__merged';

function calcHash(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function genMergeSet(game: IGame, installPath: string,
                     mods: IMod[]): Promise<{[filePath: string]: string[]}> {
  const result: {[filePath: string]: string[]} = {};
  return Promise.each(mods, mod => {
                  const modPath = path.join(installPath, mod.installationPath);
                  return getFileList(modPath).then(fileEntries => {
                    fileEntries.forEach(entry => {
                      const relPath = path.relative(modPath, entry.filePath);
                      if (game.mergeArchive(entry.filePath)) {
                        setdefault(result, relPath, []).push(modPath);
                      }
                    });
                  });
                }).then(() => result);
}

// merge a single archive
function mergeArchive(api: IExtensionApi,
                      game: IGame,
                      relArcPath: string,
                      basePath: string,
                      sources: string[],
                      mergePath: string) {
  const baseContent: { [path: string]: { size: number, hash: string } } = {};
  const resultPath = path.join(mergePath, 'result');

  return fs.ensureDirAsync(resultPath)
      // first, unpack the base/reference archive
      .then(() => fs.statAsync(path.join(basePath, relArcPath) + BACKUP_TAG)
        .then(() => path.join(basePath, relArcPath) + BACKUP_TAG))
        .catch(() => path.join(basePath, relArcPath))
      .then(sourcePath => api.openArchive(sourcePath, { gameId: game.id},
                                          path.extname(relArcPath).substr(1)))
      .then(archive => archive.extractAll(resultPath))
      // save size and hash for files from the base so we can later recognize duplicates
      // in the mod archives
      .then(() => walk(resultPath, (iterPath, stats) => stats.isDirectory()
          ? Promise.resolve()
          : calcHash(iterPath)
              .then(hash => {
                baseContent[path.relative(resultPath, iterPath)] = {
                  size: stats.size,
                  hash,
                };
              })))
      // now iterate over each mod containing the archive, extract their version
      // of the archive, then copy every file from the archive that differs from the
      // base into the output directory, overwriting the file from previous mods if
      // necessary
      .then(() => Promise.each(sources, modPath => {
        const outputPath = path.join(mergePath, path.basename(modPath));
        return fs.ensureDirAsync(outputPath)
            .then(() => api.openArchive(path.join(modPath, relArcPath)))
            .then(archive => archive.extractAll(outputPath))
            .then(() => walk(outputPath, (iterPath, stats) => {
              if (stats.isDirectory()) {
                return;
              }
              const relPath = path.relative(outputPath, iterPath);
              let isDifferentProm: Promise<boolean>;
              if ((baseContent[relPath] === undefined)
                  || (stats.size !== baseContent[relPath].size)) {
                // easy case: size is different so we know the content is different
                isDifferentProm = Promise.resolve(true);
              } else {
                // if the size is the same we need to compare hashes to know if the
                // content is the same
                isDifferentProm = calcHash(iterPath).then(hash =>
                  hash !== baseContent[relPath].hash);
              }
              return isDifferentProm.then(different => different
                ? (fs as any).moveAsync(iterPath, path.join(resultPath, relPath),
                                        { overwrite: true })
                : Promise.resolve());
            })
            .then(() => fs.removeAsync(outputPath)));
      }))
      .then(() =>
        // finally, create the new archive
        api.openArchive(path.join(mergePath, relArcPath), { gameId: game.id })
          .then(archive => archive.create(resultPath)))
      .then(() => fs.removeAsync(resultPath));
}

function prepareMerged(api: IExtensionApi,
                       game: IGame,
                       modBasePath: string,
                       destinationPath: string,
                       mods: IMod[]): Promise<string[]> {
  if (game.mergeArchive === undefined) {
    // most common case: no files need to be merged
    return Promise.resolve([]);
  }

  let mergeSet: { [file: string]: string[] };
  const mergeDest = path.join(modBasePath, MERGED_PATH);

  return fs.removeAsync(mergeDest)
      .catch(err => {
        if (err.code !== 'ENOENT') {
          return Promise.reject(err);
        }
      })
      .then(() => fs.ensureDirAsync(mergeDest))
      .then(() => genMergeSet(game, modBasePath, mods))
      .then(mergeSetIn => {
        mergeSet = mergeSetIn;
        return Promise.each(
            Object.keys(mergeSet),
            relPath => mergeArchive(api, game, relPath, destinationPath,
                                    mergeSet[relPath], mergeDest));
      })
      .then(() => Object.keys(mergeSet));
}

/**
 * activate a list of mod
 *
 * @export
 * @param {string} game the game to deploy for
 * @param {string} modBasePath the path where mods are installed
 * @param {string} destinationPath the game mod path
 * @param {IMod[]} mods list of mods to activate (sorted from lowest to highest
 * priority)
 * @param {IDeploymentMethod} method the activator to use
 * @returns {Promise<void>}
 */
export function activateMods(api: IExtensionApi,
                             game: IGame,
                             modBasePath: string,
                             destinationPath: string,
                             mods: IMod[],
                             method: IDeploymentMethod,
                             lastActivation: IDeployedFile[]): Promise<IDeployedFile[]> {
  let merged: Set<string>;
  return prepareMerged(api, game, modBasePath, destinationPath, mods)
      .then((mergedFiles: string[]) => {
        merged = new Set<string>(mergedFiles);
        return method.prepare(destinationPath, true, lastActivation);
      })
      .then(() => Promise.each(
                mods,
                mod => {
                  try {
                    return method.activate(
                        path.join(modBasePath, mod.installationPath),
                        mod.installationPath, destinationPath, merged);
                  } catch (err) {
                    log('error', 'failed to deploy mod',
                        {err: err.message, id: mod.id});
                  }
                }))
      .then(() => method.activate(path.join(modBasePath, MERGED_PATH),
                                     MERGED_PATH, destinationPath,
                                     new Set<string>()))
      .then(() => method.finalize(destinationPath));
}
