import {IExtensionApi} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import * as fs from '../../util/fs';
import getFileList, { IFileEntry } from '../../util/getFileList';
import {setdefault, truthy} from '../../util/util';
import walk from '../../util/walk';

import {IMod} from './types/IMod';
import {IResolvedMerger} from './types/IResolvedMerger';

import {BACKUP_TAG} from './LinkingDeployment';

import * as Promise from 'bluebird';
import * as crypto from 'crypto';
import * as path from 'path';

export const MERGED_PATH = '__merged';

type FileLists = Array<{modId: string, basePath: string, files: IFileEntry[]}>;

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

function genArchiveMergeSet(
    game: IGame,
    fileLists: FileLists): Promise<{[filePath: string]: string[]}> {
  const result: {[filePath: string]: string[]} = {};
  if (game.mergeArchive !== undefined) {
    fileLists.forEach(fileList => {
      fileList.files.forEach(entry => {
        if (game.mergeArchive(entry.filePath)) {
          const relPath = path.relative(fileList.basePath, entry.filePath);
          setdefault(result, relPath, []).push(fileList.basePath);
        }
      });
    });
  }
  return Promise.resolve(result);
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

function mergeMods(api: IExtensionApi,
                   game: IGame,
                   modBasePath: string,
                   destinationPath: string,
                   mods: IMod[],
                   mergers: IResolvedMerger[]): Promise<string[]> {
  if ((mergers.length === 0) && (game.mergeArchive === undefined)) {
    return Promise.resolve([]);
  }

  const mergeDest = path.join(modBasePath, MERGED_PATH);

  const archiveMerges: { [relPath: string]: string[] } = {};
  const mergedFiles: string[] = [];

  // go through all files of all mods. do "mergers" immediately, store
  // archives to be merged for later
  return Promise.mapSeries(mods, mod => {
    const modPath = path.join(modBasePath, mod.installationPath);
    return getFileList(modPath).then(fileList =>
      Promise.mapSeries(fileList, fileEntry => {
        if ((game.mergeArchive !== undefined) && game.mergeArchive(fileEntry.filePath)) {
          const relPath = path.relative(modPath, fileEntry.filePath);
          mergedFiles.push(relPath);
          setdefault(archiveMerges, relPath, []).push(modPath);
        } else {
          const merger = mergers.find(iter => iter.match.filter(fileEntry.filePath));
          if (merger !== undefined) {
            const realDest = truthy(merger.modType)
              ? mergeDest + '.' + merger.modType
              : mergeDest;
            const relPath = path.relative(modPath, fileEntry.filePath);
            mergedFiles.push(relPath);
            return fs.ensureDirAsync(realDest)
              .then(() => Promise.map(merger.match.baseFiles(),
                file => Promise.all([fs.statAsync(file.in + BACKUP_TAG).catch(err => err.code === 'ENOENT' ? undefined : Promise.reject(err)),
                  fs.statAsync(path.join(realDest, file.out)).catch(err => err.code === 'ENOENT' ? undefined : Promise.reject(err))])
                  .then(res => {
                    // res[0] points to the file.in's backup file the existence of this file suggests that the
                    //  merge is more complex as the game itself had pre-existing data within file.in; the correct
                    //  behavior in this case would be to use this file as a clean template and merge our mod
                    //  using the backup file as the template rather than using the normal file.in.

                    // res[1] points to the output merge file. This file is removed prior to this function
                    //  being called, so if the merge file already exists, this would mean that a separate 
                    //  mod has already merged its data and we should simply merge this mod's data into the output file
                    if (res[1] !== undefined) {
                      // Merge file already exists, nothing to do here.
                      return Promise.resolve();
                    } else {
                      if (res[0] !== undefined) {
                        // We found a backup file, use this file as the merge output base file.
                        return fs.copyAsync(file.in + BACKUP_TAG, path.join(realDest, file.out));
                      } else {
                        // No backup file found, ensure that the input file exists as it does not
                        //  matter if it's empty and copy it over to the output location
                        return fs.ensureFileAsync(file.in)
                          .then(() => fs.copyAsync(file.in, path.join(realDest, file.out)))
                      }
                    }
                  }).catch(err => Promise.reject(err))
                ))
                .then(() => merger.merge(fileEntry.filePath, realDest))
          }
        }
        return Promise.resolve();
      }));
    })
    // merge archives
    .then(() => Promise.mapSeries(Object.keys(archiveMerges), relPath =>
      mergeArchive(api, game, relPath, destinationPath, archiveMerges[relPath], mergeDest)))
    .then(() => mergedFiles);
}

export default mergeMods;
