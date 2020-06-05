import * as fs from './fs';

import Promise from 'bluebird';
import * as path from 'path';

export interface IWalkOptions {
  ignoreErrors?: string[] | true;
}

/**
 * recursively walk the target directory
 *
 * @param {string} target the directory to search
 * @param {any} callback called on each file and directory encountered. Receives the path and
 *                       corresponding fs stats as parameter. Should return a promise that will be
 *                       awaited before proceeding to the next directory. If this promise is
 *                       rejected, the walk is interrupted
 * @returns {Promise<void>} a promise that is resolved once the search is complete
 */
function walk(target: string,
              callback: (iterPath: string, stats: fs.Stats) => Promise<any>,
              options?: IWalkOptions): Promise<void> {
  const opt = options || {};
  let allFileNames: string[];

  return fs.readdirAsync(target)
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve([])
      : Promise.reject(err))
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return Promise.map(fileNames, (statPath: string) =>
        fs.lstatAsync([target, statPath].join(path.sep)).reflect());
    }).then((res: Array<Promise.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<Promise<any>> = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory() && (path.extname(fullPath) !== '.asar')) {
          subDirs.push(fullPath);
        }
      });
      return Promise.all(cbPromises.concat(Promise.mapSeries(subDirs, (subDir) =>
                         walk(subDir, callback))));
    })
    .catch(err => {
      if ((opt.ignoreErrors !== undefined)
          && ((opt.ignoreErrors === true)
              || (opt.ignoreErrors.indexOf(err.code) !== -1))) {
        return Promise.resolve();
      } else {
        return Promise.reject(err);
      }
    })
    .then(() => Promise.resolve());
}

export default walk;
