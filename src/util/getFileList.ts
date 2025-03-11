import walk from './walk';

import Promise from 'bluebird';
import * as fs from 'fs';

export interface IFileEntry {
  filePath: string;
  stats: fs.Stats;
}

export const IGNORABLE_PREFIXES = ['__vortex', '__merged'];

function getFileList(basePath: string): Promise<IFileEntry[]> {

  const result: IFileEntry[] = [];

  return walk(basePath, (filePath: string, stats: fs.Stats) => {
    if (!IGNORABLE_PREFIXES.some(prefix => filePath.toLowerCase().startsWith(prefix))) {
      result.push({filePath, stats});
    }
    return Promise.resolve();
  })
  .then(() => result)
  .catch(err => {
    if (err.code === 'ENOENT') {
      // if the directory doesn't exist it obviously doesn't contain files, right?
      return Promise.resolve([]);
    } else {
      return Promise.reject(err);
    }
  });
}

export default getFileList;
