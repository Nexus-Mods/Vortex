import * as fs from '../../../util/fs';
import getVortexPath from '../../../util/getVortexPath';
import { isWindows, isLinux, isMacOS } from '../../../util/platform';
import { deBOM, truthy } from '../../../util/util';

import Promise from 'bluebird';
import * as path from 'path';

/**
 * return the path where chrome stores its settings regarding disabled schemes
 *
 * @returns
 */
function chromePath(): Promise<string> {
  const appPath = getVortexPath('appData');
  if (isWindows()) {
    const userData = process.env.LOCALAPPDATA !== undefined
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data')
      : path.resolve(appPath, '..', 'Local', 'Google', 'Chrome', 'User Data');
    return fs.readFileAsync(path.join(userData, 'Local State'), { encoding: 'utf-8' })
      .then(state => {
        try {
          const dat = JSON.parse(deBOM(state));
          const prof = truthy(dat) && truthy(dat.profile) && truthy(dat.profile.last_used)
            ? dat.profile.last_used
            : 'Default';
          return Promise.resolve(path.join(userData, prof, 'Preferences'));
        } catch (err) {
          return Promise.reject(err);
        }
      })
      .catch(err => (['ENOENT', 'EBUSY', 'EPERM', 'EISDIR'].indexOf(err.code) !== -1)
        ? Promise.resolve(path.join(userData, 'Default', 'Preferences'))
        : Promise.reject(err));
  } else if (isMacOS()) {
    // On macOS, Chrome stores data in ~/Library/Application Support/Google/Chrome/
    const userData = path.resolve(appPath, 'Google', 'Chrome');
    return fs.readFileAsync(path.join(userData, 'Local State'), { encoding: 'utf-8' })
      .then(state => {
        try {
          const dat = JSON.parse(deBOM(state));
          const prof = truthy(dat) && truthy(dat.profile) && truthy(dat.profile.last_used)
            ? dat.profile.last_used
            : 'Default';
          return Promise.resolve(path.join(userData, prof, 'Preferences'));
        } catch (err) {
          return Promise.reject(err);
        }
      })
      .catch(err => (['ENOENT', 'EBUSY', 'EPERM', 'EISDIR'].indexOf(err.code) !== -1)
        ? Promise.resolve(path.join(userData, 'Default', 'Preferences'))
        : Promise.reject(err));
  } else {
    // Linux fallback
    return Promise.resolve(path.resolve(appPath, 'google-chrome', 'Local State'));
  }
}

export default chromePath;
