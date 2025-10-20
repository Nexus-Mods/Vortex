// IMPORTANT: This file is included from elevated code, it can't include electron stuff

import * as fs from 'fs-extra';

// TODO: Remove Bluebird import - using native Promise;
import * as path from 'path';
import { promiseMapSeries } from '../../../util/promise-helpers';

function walk(target: string,
              callback: (iterPath: string, stats: fs.Stats) => Promise<any>): Promise<any> {
  let allFileNames: string[];

  return Promise.resolve(fs.readdir(target))
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return promiseMapSeries(fileNames, (statPath: string) => {
        const fullPath: string = path.join(target, statPath);
        return Promise.resolve(fs.lstat(fullPath)).then(value => ({ status: "fulfilled", value })).catch(err => ({ status: "rejected", reason: err }));
      });
    }).then((res: Array<{ status: string, value?: fs.Stats, reason?: any }>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<Promise<any>> = [];
      res.forEach((stat, idx) => {
        if (stat.status !== "fulfilled") {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value));
        if (stat.value.isDirectory()) {
          subDirs.push(fullPath);
        }
      });
      return Promise.all(
        cbPromises.concat(promiseMapSeries(subDirs, (subDir) => walk(subDir, callback))));
    }).then(() => null);
}

export default walk;
