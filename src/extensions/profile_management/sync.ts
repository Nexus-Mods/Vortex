import {log} from '../../util/log';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export function syncToProfile(profilePath: string, sourceFiles: string[]): Promise<void[]> {
  log('info', 'sync to profile', sourceFiles);
  return fs.ensureDirAsync(profilePath)
  .then(() => {
    return Promise.map(sourceFiles, (filePath: string) => {
      let destPath = path.join(profilePath, path.basename(filePath));
      log('info', 'copy', { from: filePath, to: destPath });
      return fs.copyAsync(filePath, destPath);
    });
  });
}

export function syncFromProfile(profilePath: string, sourceFiles: string[]) {
  return Promise.map(sourceFiles, (filePath: string) => {
    let srcPath = path.join(profilePath, path.basename(filePath));
    return fs.copyAsync(srcPath, filePath);
  });
}
