import {IDeployedFile, IExtensionApi} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import * as fs from '../../util/fs';
import getFileList, { IFileEntry } from '../../util/getFileList';
import {setdefault, truthy} from '../../util/util';
import walk from '../../util/walk';

import {IMod} from './types/IMod';
import {IResolvedMerger} from './types/IResolvedMerger';

import {BACKUP_TAG} from './LinkingDeployment';

import Promise from 'bluebird';
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
                   deployedFiles: IDeployedFile[],
                   mergers: IResolvedMerger[]): Promise<string[]> {
  if ((mergers.length === 0) && (game.mergeArchive === undefined)) {
    return Promise.resolve([]);
  }

  const mergeDest = path.join(modBasePath, MERGED_PATH);

  const archiveMerges: { [relPath: string]: string[] } = {};
  const mergedFiles: string[] = [];

  const fileExists = (file: string) => fs.statAsync(file)
    .then(() => Promise.resolve(true))
    .catch(() => Promise.resolve(false));

  const isDeployed = (filePath: string) => deployedFiles.find(file =>
    path.join(destinationPath, file.relPath).toLowerCase()
    === filePath.toLowerCase()) !== undefined;

  // go through all files of all mods. do "mergers" immediately, store
  // archives to be merged for later
  return Promise.mapSeries(mods, mod => {
    const modPath = path.join(modBasePath, mod.installationPath);
    return getFileList(modPath)
      .filter(entry => entry.stats.isFile())
      .then(fileList =>
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
              .then(() => Promise.map(merger.match.baseFiles(deployedFiles), file => {
                if (mergedFiles.length !== 1) {
                  // We've already started merging at this point, no reason
                  //  to continue through merge setup.
                  return Promise.resolve();
                }

                // the "in" path may also be the path to where the file gets deployed to eventually,
                // in which case it will point to the already-modified file after the first
                // deployment.
                // In this case we need to use the backup as the input instead of the actual "in"
                // path
                return Promise.all([fileExists(file.in),
                                    fileExists(file.in + BACKUP_TAG)]).then(res => {
                  // res[0] indicates whether we were able to find the input file inside
                  //  the mods folder. Its existence can mean 2 things depending on circumstances:
                  //  1. The file is a symlink and has been deployed using Vortex. We can confirm
                  //   this by checking the deployed files array for this modtype.
                  //  2. The file exists by default (created by the game itself).

                  // res[1] indicates whether we are able to find an input file backup which is
                  //  created by Vortex when deploying the output file, and a pre-existing input
                  //  file was found during deployment. (See res[0], item 2). When res[1] === true,
                  //  this is a clear indication that we have previously deployed mods for this
                  //  modType; to avoid losing default game generated data, we MUST use the backup
                  //  file as the base for the merge.
                  if (res[1]) {
                    // We found a backup file, use this file as the base for the merge.
                    return fs.copyAsync(file.in + BACKUP_TAG, path.join(realDest, file.out));
                  } else if (res[0]) {
                    if (isDeployed(file.in)) {
                      // The input file has been previously deployed by Vortex but there is no
                      // backup.
                      // This indicates that the merge previously happened on an empty source file
                      // and we need to ensure that the same happens for this merge
                      return fs.removeAsync(file.in);
                    } else {
                      // The input file exists and is not part of the deployment so it's an actual
                      // source file to build upon. This should be the default case for a first
                      // deployment.
                      return fs.copyAsync(file.in, path.join(realDest, file.out));
                    }
                  }
                });
            }))
            .then(() => merger.merge(fileEntry.filePath, realDest));
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
