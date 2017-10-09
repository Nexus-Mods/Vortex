import { IConflict } from '../types/IConflict';
import { IModLookupInfo } from '../types/IModLookupInfo';

import isBlacklisted from './blacklist';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { types, util } from 'vortex-api';

interface IFileMap {
  [filePath: string]: types.IMod[];
}

function toLookupInfo(mod: types.IMod): IModLookupInfo {
  return {
    id: mod.id,
    fileMD5: mod.attributes['fileMD5'],
    customFileName: mod.attributes['customFileName'],
    fileName: mod.attributes['fileName'],
    fileSizeBytes: mod.attributes['fileSizeBytes'],
    logicalFileName: mod.attributes['logicalFileName'],
    name: mod.attributes['name'],
    version: mod.attributes['version'],
  };
}

function getAllFiles(basePath: string, mods: types.IMod[]): Promise<IFileMap> {
  const files: IFileMap = {};
  return Promise.map(mods, (mod: types.IMod) => {
    const modPath = path.join(basePath, mod.installationPath);
    return util.walk(modPath, (iterPath: string, stat: fs.Stats) => {
      if (stat.isFile()) {
        const relPath = path.relative(modPath, iterPath);
        util.setdefault(files, relPath.toLowerCase(), []).push(mod);
      }
      return Promise.resolve();
    });
  })
    .then(() => files);
}

interface IConflictMap {
  [lhsId: string]: { [rhsId: string]: string[] };
}

function getConflictMap(files: IFileMap): IConflictMap {
  const conflictFiles = Object.keys(files)
    .filter(filePath => (files[filePath].length > 1) && !isBlacklisted(filePath));

  const conflicts: IConflictMap = {};
  conflictFiles.forEach(filePath => {
    const file = files[filePath];
    for (let i = 0; i < file.length; ++i) {
      for (let j = 0; j < file.length; ++j) {
        if (i !== j) {
          util.setdefault(util.setdefault(conflicts, file[i].id, {}), file[j].id, [])
            .push(filePath);
        }
      }
    }
  });
  return conflicts;
}

function findConflicts(basePath: string,
                       mods: types.IMod[]): Promise<{ [modId: string]: IConflict[] }> {
  let normFunc: (input: string) => string;
  return util.getNormalizeFunc(basePath)
    .then(func => {
      normFunc = func;
      return getAllFiles(basePath, mods);
    })
    .then((files: IFileMap) => {
      const conflictMap = getConflictMap(files);
      const conflictsByMod: { [modId: string]: IConflict[] } = {};
      Object.keys(conflictMap).forEach(lhsId => {
        Object.keys(conflictMap[lhsId]).forEach(rhsId => {
          if (conflictsByMod[lhsId] === undefined) {
            conflictsByMod[lhsId] = [];
          }
          conflictsByMod[lhsId].push({
            otherMod: toLookupInfo(mods.find(mod => mod.id === rhsId)),
            files: conflictMap[lhsId][rhsId],
          });
        });
      });
      return conflictsByMod;
  });
}

export default findConflicts;
