import * as fs from '../../../util/fs';
import {LogLevel} from '../../../util/log';

import { ILog, ISession } from '../types/ISession';

import Promise from 'bluebird';
import * as path from 'path';
import getVortexPath from '../../../util/getVortexPath';

const lineRE = /^(\S+) \[([A-Z]*)\] (.*)\r?/;

function parseLine(line: string, idx: number): ILog {
  const match = line.match(lineRE);
  if ((match !== null) && (match.length === 4)) {
    return {
      lineno: idx,
      time: match[1],
      type: match[2].toLowerCase() as LogLevel,
      text: match[3],
    };
  } else {
    return undefined;
  }
}

export function loadVortexLogs(): Promise<ISession[]> {
  const logPath = getVortexPath('userData');

  return Promise.resolve(fs.readdirAsync(logPath))
    .filter((fileName: string) => fileName.match(/vortex[0-9]?\.log/) !== null)
    .then((logFileNames: string[]) => {
      logFileNames = logFileNames.sort((lhs: string, rhs: string) => rhs.localeCompare(lhs));
      return Promise.mapSeries(logFileNames, (logFileName: string) =>
                              fs.readFileAsync(path.join(logPath, logFileName), 'utf8'));
    })
    .then((data: string[]) => data.join('\n'))
    .then((text: string) => {
      const splittedSessions = text.split('[INFO] --------------------------');

      return splittedSessions.map((sessionElement: string): ISession => {
        // const splittedLogs = sessionElement.split(/\r?\n(?!^[ ])(?!^\n)(?!^[ERROR])/m);
        const logElements: ILog[] = sessionElement
          .split('\n')
          .map(parseLine)
          .filter(line => line !== undefined);

        return ((logElements.length > 1) ?
                    {
                      from: new Date(Date.parse(logElements[0].time)),
                      to: new Date(Date.parse(logElements[logElements.length - 1].time)),
                      logs: logElements,
                    } :
                    undefined) as ISession;
      });
    })
    .filter((session: ISession) => session !== undefined);
}
