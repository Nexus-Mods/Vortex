// IMPORTANT: This file is included from elevated code, it can't include electron stuff

import * as fs from 'fs-extra';

import Bluebird from 'bluebird';
import * as path from 'path';

function walk(target: string,
              callback: (iterPath: string, stats: fs.Stats) => Bluebird<any>): Bluebird<any> {
  let allFileNames: string[];

  return Bluebird.resolve(fs.readdir(target))
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return Bluebird.mapSeries(fileNames, (statPath: string) => {
        const fullPath: string = path.join(target, statPath);
        return Bluebird.resolve(fs.lstat(fullPath)).reflect();
      });
    }).then((res: Array<Bluebird.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<Bluebird<any>> = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory()) {
          subDirs.push(fullPath);
        }
      });
      return Bluebird.all(
        cbPromises.concat(Bluebird.mapSeries(subDirs, (subDir) => walk(subDir, callback))));
    }).then(() => null);
}

export default walk;
