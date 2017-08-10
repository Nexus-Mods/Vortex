const invalidWindowsChars: string[] = [ '<',  '>', ':', '"', '/', '\\', '|', '?', '*' ];
const invalidOSXChars: string[] = [ '/'];
const invalidLinuxChars: string[] = [ '/' ];

export function deriveModInstallName(archiveName: string, info: any) {
  return maskFSInvalidChars(archiveName, process.platform);
}

function maskFSInvalidChars(archiveName: string, OS: string) {
  let invalidChars: string[] = [];
  if (OS === 'linux') {
    invalidChars = invalidLinuxChars;
  } else if (OS === 'darwin') {
    invalidChars = invalidOSXChars;
  } else if (OS === 'win32') {
    invalidChars = invalidWindowsChars;
  }

  let maskedName = '';

  for (let i = 0, len = archiveName.length; i < len; i++) {
    if (invalidChars.indexOf(archiveName[i]) >= 0) {
      maskedName += '_' + archiveName[i].charCodeAt(0) + '_';
    } else {
      maskedName += archiveName[i];
    }
  }

  return maskedName;
}

export default deriveModInstallName;
