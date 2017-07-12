/**
 * wrapper for logging functionality
 */

/** dummy */
import * as path from 'path';
import winstonT = require('winston');

let logger: winstonT.LoggerInstance = null;

// magic: when we're in the main process, this uses the logger from winston
// (which appears to be a singleton). In the renderer processes we connect
// to the main-process logger through ipc
if ((process as any).type === 'renderer') {
  // tslint:disable-next-line:no-var-requires
  const { remote } = require('electron');
  logger = remote.getGlobal('logger');
} else {
  // tslint:disable-next-line:no-var-requires
  logger = require('winston');
  (global as any).logger = logger;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function setLogPath(basePath: string) {
  logger.remove(logger.transports['File']);

  logger.add(logger.transports['File'], {
    filename: path.join(basePath, 'vortex.log'),
    json: false,
    level: 'debug',
    maxsize: 1024 * 1024,
    maxFiles: 5,
    tailable: true,
    timestamp: () => new Date().toUTCString(),
  });
}

/**
 * application specific logging setup
 *
 * @export
 */
export function setupLogging(basePath: string, useConsole: boolean): void {
  logger.add(logger.transports['File'], {
    filename: path.join(basePath, 'vortex.log'),
    json: false,
    level: 'debug',
    maxsize: 1024 * 1024,
    maxFiles: 5,
    tailable: true,
    timestamp: () => new Date().toUTCString(),
  });

  if (!useConsole) {
    logger.remove(logger.transports['Console']);
  }
  logger.log('info', '--------------------------');
}

/**
 * log a message
 *
 * @export
 * @param {Level} level The log level of the message: 'debug', 'info' or 'error'
 * @param {string} message The text message. Should contain no variable data
 * @param {any} [metadata] Additional information about the error instance
 */
export function log(level: LogLevel, message: string, metadata?: any) {
  if (metadata === undefined) {
    logger.log(level, message);
  } else {
    logger.log(level, message, metadata);
  }
}
