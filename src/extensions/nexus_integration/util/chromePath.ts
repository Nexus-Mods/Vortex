import * as fs from '../../../util/fs';
import getVortexPath from '../../../util/getVortexPath';
import { deBOM, truthy } from '../../../util/util';

import Bluebird from 'bluebird';
import * as path from 'path';

/**
 * return the path where chrome stores its settings regarding disabled schemes
 *
 * @returns
 */
function chromePath(): Bluebird<string> {
  const appPath = getVortexPath('appData');
  if (process.platform === 'win32') {
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
          return Bluebird.resolve(path.join(userData, prof, 'Preferences'));
        } catch (err) {
          return Bluebird.reject(err);
        }
      })
      .catch(err => (['ENOENT', 'EBUSY', 'EPERM', 'EISDIR'].indexOf(err.code) !== -1)
        ? Bluebird.resolve(path.join(userData, 'Default', 'Preferences'))
        : Bluebird.reject(err));
  } else {
    return Bluebird.resolve((process.platform === 'linux')
      ? path.resolve(appPath, 'google-chrome', 'Local State')
      : path.resolve(appPath, 'Google', 'Chrome', 'Local State'));
  }
}

export default chromePath;
