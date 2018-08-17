/**
 * wrapper for logging functionality
 */

/** dummy */
import * as path from 'path';
import * as winston from 'winston';
import * as WinstonTransport from 'winston-transport';

class IPCTransport extends WinstonTransport {
  private mIPC;
  constructor(options: WinstonTransport.TransportStreamOptions) {
    super(options)
    this.mIPC = require('electron').ipcRenderer;
  }

  public log(info: any, next: () => void) {
    const { level, message, ...meta } = info;
    this.mIPC.send('log-message', level, message, meta);
    next();
  }
}

let logger: winston.Logger = null;

// magic: when we're in the main process, this uses the logger from winston
// (which appears to be a singleton). In the renderer processes we connect
// to the main-process logger through ipc
if ((process as any).type === 'renderer') {
  // tslint:disable-next-line:no-var-requires
  logger = winston.createLogger({
    level: 'debug',
    transports: [ new IPCTransport({}) ],
  });
} else {
  // when being required from extensions, don't re-require the winston module
  // because the "singleton" is implemented abusing the require-cache
  if ((global as any).logger === undefined) {
    // tslint:disable-next-line:no-var-requires
    (global as any).logger = logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => {
          const { timestamp, level, message, ...rest } = info;
          if (Object.keys(rest || {}).length === 0) {
            return `${timestamp} - ${level}: ${message}`;
          } else {
            return `${timestamp} - ${level}: ${message} (${JSON.stringify(rest)})`;
          }
        })),
    });
  } else {
    logger = (global as any).logger;
  }
  // tslint:disable-next-line:no-var-requires
  const { ipcMain } = require('electron');
  if (ipcMain !== undefined) {
    ipcMain.on('log-message',
      (event, level: LogLevel, message: string, metadata?: any[]) => {
        logger.log(level, message, metadata);
      });
  } // otherwise we're not in electron
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function setLogPath(basePath: string) {
  logger.remove(logger.transports['File']);

  logger.add(new winston.transports.File({
    filename: path.join(basePath, 'vortex.log'),
    level: 'debug',
    maxsize: 1024 * 1024,
    maxFiles: 5,
    tailable: true,
  }));

  logger.log('info', 'does it work yet?');
}

/**
 * application specific logging setup
 *
 * @export
 */
export function setupLogging(basePath: string, useConsole: boolean): void {
  try {
    logger.add(new winston.transports.File({
      filename: path.join(basePath, 'vortex.log'),
      level: 'debug',
      maxsize: 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }));

    if (!useConsole) {
      logger.remove(logger.transports['Console']);
    }
  } catch (err) {
    // logger.add dynamically calls requires('./transport/file'). For some reason that
    // fails when this exe is called from chrome as a protocol handler. I've debugged as
    // far as I can, it fails in a stat call to asar. The parameter is fine, the file
    // exists and it worked in past versions so it appears to be a bug in electron
    logger.log('error', 'Failed to set up logging to file', {error: err.message});
  }
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
