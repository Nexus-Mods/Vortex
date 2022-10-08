import walk from './walk';

import Bluebird from 'bluebird';
import * as fs from 'fs';

export interface IFileEntry {
  filePath: string;
  stats: fs.Stats;
}

function getFileList(basePath: string): Bluebird<IFileEntry[]> {

  const result: IFileEntry[] = [];

  return walk(basePath, (filePath: string, stats: fs.Stats) => {
    if (!filePath.startsWith('__')) {
      result.push({filePath, stats});
    }
    return Bluebird.resolve();
  })
  .then(() => result)
  .catch(err => {
    if (err.code === 'ENOENT') {
      // if the directory doesn't exist it obviously doesn't contain files, right?
      return Bluebird.resolve([]);
    } else {
      return Bluebird.reject(err);
    }
  });
}

export default getFileList;
