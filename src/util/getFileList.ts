import walk from './walk';

import * as Promise from 'bluebird';
import * as fs from 'fs';

interface IFileEntry {
  filePath: string;
  stats: fs.Stats;
}

function getFileList(basePath: string): Promise<IFileEntry[]> {

  const result: IFileEntry[] = [];

  return walk(basePath, (filePath: string, stats: fs.Stats) => {
    if (!filePath.startsWith('__')) {
      result.push({filePath, stats});
    }
    return Promise.resolve();
  })
  .then(() => result);
}

export default getFileList;
