import { ILog, ISession } from '../types/iSession';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export function loadVortexLogs(): Promise<ISession[]> {

  const logPath = remote.app.getPath('userData');
  const sessionArray: ISession[] = [];

  return fs.readdirAsync(logPath)
    .then((logPathFiles: string[]) => {
      const logFiles = logPathFiles.filter((file) => path.extname(file) ===
        '.log').sort((lhs: string, rhs: string) => rhs.localeCompare(lhs));
      return Promise.each(logFiles, (logFileName: string) => {
        return fs.readFileAsync(path.join(logPath, logFileName), 'utf8')
          .then(text => {
            const splittedSessions = text.split('- info: --------------------------');

            splittedSessions.forEach((sessionElement, sessionIndex) => {

              const splittedLogs = sessionElement.split('\r\n');
              const logArray: ILog[] = [];

              splittedLogs.forEach((element, index) => {
                let textType = '';
                if (element.toLowerCase().indexOf('- error:') > -1) {
                  textType = 'ERROR';
                }

                if (element !== '' && index !== splittedLogs.length - 1) {
                  logArray.push({
                    text: element,
                    type: textType,
                  });
                }
              });

              if (logArray.length > 1) {
                sessionArray.push({
                  from: sessionElement !== undefined ? sessionElement.substring(0, 31) : '',
                  to: logArray[logArray.length - 1].text.substring(0, 31),
                  logs: logArray,
                });
              }
            });
          });
      });
    })
    .then(() => {
      return Promise.resolve(sessionArray);
    });
}
