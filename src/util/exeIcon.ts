import makeRemoteCall from './electronRemote';
import * as fs from './fs';

const efi = makeRemoteCall('extract-file-icon',
    (electron, content, exePath: string, iconPath: string) => {
  return electron.app.getFileIcon(exePath, { size: 'normal' })
    .then(icon => fs.writeFileAsync(iconPath, icon.toPNG()))
    .then(() => null);
});

function extractExeIcon(exePath: string, destPath: string): Promise<void> {
  // app.getFileIcon generated broken output on windows as of electron 11.0.4
  // (see https://github.com/electron/electron/issues/26918)
  // This issue has not been closed or so much as been replied to, however I was not able to
  // reproduce it so I'm tentatively removing the windows-specific workaround as of
  // Vortex 1.6.0

  /*
  if (process.platform === 'win32') {
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
  */
    return efi(exePath, destPath);
  // }
}

export default extractExeIcon;
