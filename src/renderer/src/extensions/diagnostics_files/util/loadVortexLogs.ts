import * as fs from "../../../util/fs";
import type { LogLevel } from "../../../util/log";

import type { ILog, ISession } from "../types/ISession";

import PromiseBB from "bluebird";
import * as path from "path";
import getVortexPath from "../../../util/getVortexPath";

// New format: timestamp [LEVEL] [PROCESS] message
const lineRE = /^(\S+) \[([A-Z]*)\] \[([A-Z]*)\] (.*)\r?/;
// Legacy format: timestamp [LEVEL] message
const lineRE_Legacy = /^(\S+) \[([A-Z]*)\] (.*)\r?/;
// ANSI color code regex (constructed to avoid ESLint error)
// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1b\[[0-9;]*m/g;

function parseLine(line: string, idx: number): ILog {
  // Strip ANSI color codes from the line
  const cleanLine = line.replace(ansiRegex, "");

  // Try new format first (with [PROCESS])
  let match = cleanLine.match(lineRE);
  if (match !== null && match.length === 5) {
    return {
      lineno: idx,
      time: match[1],
      type: match[2].toLowerCase() as LogLevel,
      text: match[4], // Skip the process name in match[3], use the message in match[4]
    };
  }

  // Fall back to legacy format (without [PROCESS])
  match = cleanLine.match(lineRE_Legacy);
  if (match !== null && match.length === 4) {
    return {
      lineno: idx,
      time: match[1],
      type: match[2].toLowerCase() as LogLevel,
      text: match[3],
    };
  }

  return undefined;
}

export function loadVortexLogs(): PromiseBB<ISession[]> {
  const logPath = getVortexPath("userData");

  return PromiseBB.resolve(fs.readdirAsync(logPath))
    .filter((fileName: string) => fileName.match(/vortex[0-9]?\.log/) !== null)
    .then((logFileNames: string[]) => {
      logFileNames = logFileNames.sort((lhs: string, rhs: string) =>
        rhs.localeCompare(lhs),
      );
      return PromiseBB.mapSeries(logFileNames, (logFileName: string) =>
        fs.readFileAsync(path.join(logPath, logFileName), "utf8"),
      );
    })
    .then((data: string[]) => data.join("\n"))
    .then((text: string) => {
      const splittedSessions = text.split("[INFO] --------------------------");

      return splittedSessions.map((sessionElement: string): ISession => {
        // const splittedLogs = sessionElement.split(/\r?\n(?!^[ ])(?!^\n)(?!^[ERROR])/m);
        const logElements: ILog[] = sessionElement
          .split("\n")
          .map(parseLine)
          .filter((line) => line !== undefined);

        return (
          logElements.length > 1
            ? {
                from: new Date(Date.parse(logElements[0].time)),
                to: new Date(
                  Date.parse(logElements[logElements.length - 1].time),
                ),
                logs: logElements,
              }
            : undefined
        ) as ISession;
      });
    })
    .filter((session: ISession) => session !== undefined);
}
