import {log} from '../../util/log';
import {copyFileAtomic} from '../../util/util';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export function syncToProfile(
  profilePath: string, sourceFiles: string[],
  onError: (error: string, details: string | Error) => void): Promise<void> {
  log('debug', 'sync to profile', { profilePath, sourceFiles });
  return fs.ensureDirAsync(profilePath)
  .then(() => {
    return Promise.map(sourceFiles, (filePath: string) => {
      let destPath = path.join(profilePath, path.basename(filePath));
      return copyFileAtomic(filePath, destPath)
      .catch((err) => {
        onError('failed to sync to profile', err);
      });
    });
  }).then(() => {
    log('debug', 'sync to profile complete');
  });
}

export function syncFromProfile(
  profilePath: string, sourceFiles: string[],
  onError: (error: string, details: string | Error) => void): Promise<void> {
  log('debug', 'sync from profile', { profilePath, sourceFiles });
  return Promise.map(sourceFiles, (filePath: string) => {
    let srcPath = path.join(profilePath, path.basename(filePath));
    return copyFileAtomic(srcPath, filePath)
    .catch((err) => {
      if (err.code !== 'ENOENT') {
        onError('failed to sync from profile', err);
      }
    });
  }).then(() => {
    log('debug', 'sync from profile complete');
  });
}
