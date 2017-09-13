import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

/**
 * return the path where chrome stores its settings regarding disabled schemes
 *
 * @returns
 */
function chromePath() {
  const appPath = remote.app.getPath('appData');
  return (process.platform === 'win32')
    ? path.resolve(appPath, '..', 'Local', 'Google', 'Chrome',
                   'User Data', 'Default', 'Preferences')
    : (process.platform === 'linux')
      ? path.resolve(appPath, 'google-chrome', 'Local State')
      : path.resolve(appPath, 'Google', 'Chrome', 'Local State');
}

export default chromePath;
