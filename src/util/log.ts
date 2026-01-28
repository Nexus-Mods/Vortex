/**
 * wrapper for logging functionality
 */

/** dummy */
import * as path from "path";
import * as util from "util";
import winston from "winston";

export function valueReplacer() {
  const known = new Map();

  return (key: string, value: any) => {
    if (typeof value === "object") {
      if (known.has(value)) {
        return "<Circular>";
      }

      known.set(value, true);
    } else if (typeof value === "bigint") {
      // BigInt values are not serialized in JSON by default.
      return value.toString();
    }

    return value;
  };
}

function IPCTransport(options: winston.TransportOptions) {
  this.name = "IPCTransport";
  this.level = "debug";
}

let logger: typeof winston;

// magic: when we're in the main process, this uses the logger from winston
// (which appears to be a singleton). In the renderer processes we connect
// to the main-process logger through ipc
if ((process as any).type === "renderer") {
  // tslint:disable-next-line:no-var-requires
  const { ipcRenderer } = require("electron");
  IPCTransport.prototype.log = (
    level: string,
    message: string,
    meta: any[],
    callback: winston.LogCallback,
  ) => {
    ipcRenderer.send(
      "log-message",
      level,
      message,
      meta !== undefined ? JSON.stringify(meta, valueReplacer()) : undefined,
    );
    callback(null);
  };

  // tslint:disable-next-line:no-var-requires
  logger = require("winston");
  util.inherits(IPCTransport, logger.Transport);
  logger.configure({
    transports: [new IPCTransport({})],
  });
} else {
  // when being required from extensions, don't re-require the winston module
  // because the "singleton" is implemented abusing the require-cache
  if ((global as any).logger === undefined) {
    // tslint:disable-next-line:no-var-requires
    logger = require("winston");
    (global as any).logger = logger;
  } else {
    logger = (global as any).logger;
  }
  // tslint:disable-next-line:no-var-requires
  const { ipcMain } = require("electron");
  if (ipcMain !== undefined) {
    ipcMain.on(
      "log-message",
      (event, level: LogLevel, message: string, metadataSer?: string) => {
        try {
          const metadata =
            metadataSer !== undefined ? JSON.parse(metadataSer) : undefined;
          logger.log(level, message, metadata);
        } catch (e) {
          // failed to log, what am I supposed to do now?
        }
      },
    );
  } // otherwise we're not in electron
  // TODO: very weird issue, getting an EPIPE error if log is called before setupLogging
  //   unless we do a console.log first.
  // tslint:disable-next-line:no-console
  console.log("logging started");
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Formats log level to fixed 4-character width for consistent log alignment
 */
function formatLogLevel(level: string): string {
  switch (level) {
    case "debug":
      return "DEBG";
    case "info":
      return "INFO";
    case "warn":
      return "WARN";
    case "error":
      return "ERRO";
    default:
      return level.toUpperCase();
  }
}

export function setLogPath(basePath: string) {
  // remove the original transport so we can add the new one back again
  logger.remove(logger.transports["File"]);

  // add the new transport
  logger.add(logger.transports["File"], {
    filename: path.join(basePath, "vortex.log"),
    json: false,
    level: "debug",
    maxsize: 1024 * 1024,
    maxFiles: 5,
    tailable: true,
    timestamp: () => new Date().toISOString(),
    formatter: (options: any) => {
      return `${options.timestamp()} [${formatLogLevel(options.level)}] ${options.message !== undefined ? options.message : ""} ${options.meta && Object.keys(options.meta).length ? JSON.stringify(options.meta) : ""}`;
    },
  });
}

/**
 * application specific logging setup
 *
 * @export
 */
export function setupLogging(basePath: string, useConsole: boolean): void {
  try {
    // remove default one as we can't change things after added
    logger.remove(logger.transports["Console"]);

    // add the new transport
    logger.add(logger.transports["File"], {
      filename: path.join(basePath, "vortex.log"),
      json: false,
      level: "debug",
      maxsize: 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      timestamp: () => new Date().toISOString(),
      formatter: (options: any) => {
        return `${options.timestamp()} [${formatLogLevel(options.level)}] ${options.message !== undefined ? options.message : ""} ${options.meta && Object.keys(options.meta).length ? JSON.stringify(options.meta) : ""}`;
      },
    });

    // if we are using console (development enviorment) then add back a new console transport with better logging format
    if (useConsole) {
      logger.add(logger.transports["Console"], {
        level: "debug",
        timestamp: () => new Date().toISOString(),
        formatter: (options: any) => {
          return `${options.timestamp()} [${winston.config.colorize(options.level, formatLogLevel(options.level))}] ${options.message !== undefined ? options.message : ""} ${options.meta && Object.keys(options.meta).length ? JSON.stringify(options.meta) : ""}`;
          //(options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
        },
      });
    }
  } catch (err) {
    // logger.add dynamically calls requires('./transport/file'). For some reason that
    // fails when this exe is called from chrome as a protocol handler. I've debugged as
    // far as I can, it fails in a stat call to asar. The parameter is fine, the file
    // exists and it worked in past versions so it appears to be a bug in electron
    logger.log("error", "Failed to set up logging to file", err);
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
export function log(level: LogLevel, message: string, metadata?: unknown) {
  try {
    if (!metadata) {
      logger.log(level, message);
    } else {
      if (metadata instanceof Error) {
        logger.log(level, message, metadata.message);
      } else {
        logger.log(level, message, metadata);
      }
    }
  } catch (err) {
    console.log("failed to log to file", { level, message, metadata, err });
  }
}
