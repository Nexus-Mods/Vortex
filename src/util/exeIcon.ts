import { app as appIn, remote } from 'electron';
import * as iconExtract from 'icon-extract';
import * as fs from './fs';

const app = remote !== undefined ? remote.app : appIn;

function extractExeIcon(exePath: string, destPath: string): Promise<void> {
  if (process.platform === 'win32') {
    // app.getFileIcon generates broken output as of electron 11.0.4, afaik this
    // is limited to windows (see https://github.com/electron/electron/issues/26918)
    return new Promise((resolve, reject) => {
      iconExtract.extractIconToFile(exePath, destPath, error => {
        if (error !== null) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } else {
    app
      .getFileIcon(exePath, { size: 'normal' })
      .then(icon => fs.writeFileAsync(destPath, icon.toPNG()));
  }
}

export default extractExeIcon;
