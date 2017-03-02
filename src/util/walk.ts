import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

let tlBlacklist = new Set<string>([
  '$RECYCLE.BIN',
  '$$PendingFiles',
  'Windows',
]);

function testBlacklist(name: string, filePath: string) {
  const isTopLevel = filePath.indexOf('\\') === -1;
  return !isTopLevel || !tlBlacklist.has(name);
}

function walk(target: string,
              callback: (iterPath: string, stats: fs.Stats) => Promise<any>): Promise<any> {
  let allFileNames: string[];

  return fs.readdirAsync(target)
    .then((fileNames: string[]) => {
      allFileNames = fileNames.filter((fileName) => testBlacklist(fileName, target));
      return Promise.mapSeries(
          allFileNames,
          (statPath: string) => {
            let fullPath: string = path.join(target, statPath);
            return fs.lstatAsync(fullPath).reflect();
          });
    }).then((res: Promise.Inspection<fs.Stats>[]) => {
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
      return Promise.all(cbPromises.concat(Promise.mapSeries(subDirs, (subDir) => {
        return walk(subDir, callback);
      })));
    });
}

export default walk;
