import * as fs from '../../../util/fs';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

/**
 * return the path where chrome stores its settings regarding disabled schemes
 *
 * @returns
 */
function chromePath(): Promise<string> {
  const appPath = remote.app.getPath('appData');
  if (process.platform === 'win32') {
    const userData = path.resolve(appPath, '..', 'Local', 'Google', 'Chrome',
                                  'User Data');
    return fs.readFileAsync(path.join(userData, 'Local State'), { encoding: 'utf-8' })
      .then(state => {
        const dat = JSON.parse(state);
        const prof = (dat.profile !== undefined) && (dat.profile.last_used !== undefined)
          ? dat.profile.last_used
          : 'Default';
        return path.join(userData, prof, 'Preferences');
      });
  } else {
    return Promise.resolve((process.platform === 'linux')
      ? path.resolve(appPath, 'google-chrome', 'Local State')
      : path.resolve(appPath, 'Google', 'Chrome', 'Local State'));
  }
}

export default chromePath;
