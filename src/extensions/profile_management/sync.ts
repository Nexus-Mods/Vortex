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
  .then(() =>
    Promise.map(sourceFiles, (filePath: string) => {
      const destPath = path.join(profilePath, path.basename(filePath));
      return copyFileAtomic(filePath, destPath)
      .catch(err => {
        log('warn', 'failed to copy to profile', { filePath, destPath });
        if (err.code !== 'EBADF') {
          // EBADF would indicate the file doesn't exist, which isn't a problem,
          // it's as if the file was empty
          onError('failed to sync to profile: ' + filePath, err);
        }
      });
    }))
  .then(() => {
    log('debug', 'sync to profile complete');
  })
  .catch(err =>
    Promise.reject(new Error('failed to sync to profile: ' + err.message)));
}

export function syncFromProfile(
  profilePath: string, sourceFiles: string[],
  onError: (error: string, details: string | Error) => void): Promise<void> {
  log('debug', 'sync from profile', { profilePath, sourceFiles });
  return Promise.map(sourceFiles, (filePath: string) => {
    const srcPath = path.join(profilePath, path.basename(filePath));
    return copyFileAtomic(srcPath, filePath)
    .catch(err => {
      if (err.code !== 'ENOENT') {
        onError('failed to sync from profile', err);
      }
    });
  }).then(() => {
    log('debug', 'sync from profile complete');
  })
  .catch(err =>
    Promise.reject(new Error('failed from sync to profile: ' + err.message)));
}
