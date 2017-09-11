import { ILog, ISession } from '../types/iSession';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export function loadVortexLogs(): Promise<ISession[]> {

  const logPath = remote.app.getPath('userData');
  const sessions: ISession[] = [];

  return fs.readdirAsync(logPath)
    .then((logPathFiles: string[]) => {
      const logFiles = logPathFiles.filter((file) =>
        path.extname(file) === '.log' &&
        path.basename(file).substring(0, 6) === 'vortex',
      ).sort((lhs: string, rhs: string) => rhs.localeCompare(lhs));
      return Promise.each(logFiles, (logFileName: string) => {
        return fs.readFileAsync(path.join(logPath, logFileName), 'utf8')
          .then(text => {
            const splittedSessions = text.split('- info: --------------------------');

            splittedSessions.forEach((sessionElement, sessionIndex) => {

              const splittedLogs = sessionElement.split(/\r?\n(?!^[ ])(?!^\n)(?!^[ERROR])/m);
              const logElements: ILog[] = [];

              splittedLogs.forEach((element, index) => {
                let textType = '';

                if (element.substring(30, 38) === '- error:') {
                  textType = 'ERROR';
                } else if (element.substring(30, 38) === '- debug:') {
                  textType = 'DEBUG';
                } else if (element.substring(30, 37) === '- info:') {
                  textType = 'INFO';
                } else if (element.substring(30, 37) === '- warn:') {
                  textType = 'WARNING';
                }

                if (element !== '' && index !== splittedLogs.length - 1) {
                  logElements.push({
                    text: element,
                    type: textType,
                  });
                }
              });

              if (logElements.length > 1) {
                const parsedFrom = Date.parse(sessionElement.substring(0, 31));
                if (sessionElement !== undefined && !isNaN(parsedFrom)) {
                  sessions.push({
                    from: sessionElement.substring(0, 31),
                    to: logElements[logElements.length - 1].text.substring(0, 30),
                    logs: logElements,
                  });
                }
              }
            });
          });
      });
    })
    .then(() => {
      return Promise.resolve(sessions.sort((lhs: ISession, rhs: ISession) =>
        new Date(lhs.from).getTime() < new Date(rhs.from).getTime() ? 1 : -1));
    });
}
