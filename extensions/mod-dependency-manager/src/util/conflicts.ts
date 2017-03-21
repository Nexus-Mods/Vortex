import { IConflict } from '../types/IConflict';

import isBlacklisted from './blacklist';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { types, util } from 'nmm-api';
import * as path from 'path';

type FileMap = { [filePath: string]: types.IMod[] };

function getAllFiles(basePath: string, mods: types.IMod[]): Promise<FileMap> {
  let files: FileMap = {};
  return Promise.map(mods, (mod: types.IMod) => {
    const modPath = path.join(basePath, mod.installationPath);
    return util.walk(modPath, (iterPath: string, stat: fs.Stats) => {
      if (stat.isFile()) {
        let relPath = path.relative(modPath, iterPath);
        if (files[relPath] === undefined) {
          files[relPath] = [];
        }
        files[relPath].push(mod);
      }
      return Promise.resolve();
    });
  }
  )
    .then(() => {
      return files;
    });
}

type ConflictMap = { [lhsId: string]: { [rhsId: string]: string[] } };

function getConflictMap(files: FileMap): ConflictMap {
  const conflictFiles = Object.keys(files)
    .filter(filePath => (files[filePath].length > 1) && !isBlacklisted(filePath));

  let conflicts: ConflictMap = {};
  conflictFiles.forEach(filePath => {
    let file = files[filePath];
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
    .then((files: FileMap) => {
      const conflictMap = getConflictMap(files);
      const conflictsByMod: { [modId: string]: IConflict[] } = {};
      Object.keys(conflictMap).forEach(lhsId => {
        Object.keys(conflictMap[lhsId]).forEach(rhsId => {
          if (conflictsByMod[lhsId] === undefined) {
            conflictsByMod[lhsId] = [];
          }
          conflictsByMod[lhsId].push({
            otherMod: rhsId,
            files: conflictMap[lhsId][rhsId],
          });
        });
      });
      return conflictsByMod;
  });
}

export default findConflicts;
