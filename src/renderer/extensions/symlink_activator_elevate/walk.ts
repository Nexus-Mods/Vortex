// IMPORTANT: This file is included from elevated code, it can't include electron stuff

import * as fs from "fs-extra";

import PromiseBB from "bluebird";
import * as path from "path";

function walk(
  target: string,
  callback: (iterPath: string, stats: fs.Stats) => PromiseBB<any>,
): PromiseBB<any> {
  let allFileNames: string[];

  return PromiseBB.resolve(fs.readdir(target))
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return PromiseBB.mapSeries(fileNames, (statPath: string) => {
        const fullPath: string = path.join(target, statPath);
        return PromiseBB.resolve(fs.lstat(fullPath)).reflect();
      });
    })
    .then((res: Array<PromiseBB.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<PromiseBB<any>> = [];
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
      return PromiseBB.all(
        cbPromises.concat(
          PromiseBB.mapSeries(subDirs, (subDir) => walk(subDir, callback)),
        ),
      );
    })
    .then(() => null);
}

export default walk;
