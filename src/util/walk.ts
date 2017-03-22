import * as Promise from 'bluebird';
// use the standard fs-module for api-visible types so we don't force fs-extra-promise
// on everyone using the api.
import * as fsT from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

function walk(target: string,
              callback: (iterPath: string, stats: fsT.Stats) => Promise<any>): Promise<void> {
  let allFileNames: string[];

  return fs.readdirAsync(target)
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return Promise.mapSeries(
          fileNames,
          (statPath: string) => {
            let fullPath: string = path.join(target, statPath);
            return fs.lstatAsync(fullPath).reflect();
          });
    }).then((res: Promise.Inspection<fsT.Stats>[]) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      let subDirs: string[] = [];
      let cbPromises: Promise<any>[] = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        let fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory()) {
          subDirs.push(fullPath);
        }
      });
      return Promise.all(cbPromises.concat(Promise.mapSeries(subDirs, (subDir) =>
        walk(subDir, callback)
      )));
    })
    .then(() => undefined)
    ;
}

export default walk;
