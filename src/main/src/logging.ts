import path from "path";

import type { Level } from "@vortex/shared";
import winston from "winston";

import { betterIpcMain } from "./ipc";

// NOTE(erri120): There are no type definitions from the winston 2.x package for this, so here's a custom one:
type FormatOptions = {
  level: string;
  message?: string;
  meta: Metadata;
  timestamp: () => string;
};

type Metadata = {
  process: "main" | "renderer";
  extra?: string;
};

function customFormatter(options: FormatOptions, forConsole: boolean): string {
  const formattedLogLevel = formatLogLevel(options.level);
  const timestamp = options.timestamp();

  // NOTE(erri120): looks weird but is correct, config.colorize is mistyped in 2.x
  // https://github.com/winstonjs/winston/blob/b8baf4c6797d652f882e61a8a3bd8d00875e5596/lib/winston/config.js#L21
  const logLevel = forConsole
    ? winston.config.colorize(options.level as unknown as number, formattedLogLevel)
    : formattedLogLevel;

  const message = options.message ?? "";
  const meta = options.meta?.extra ?? "";
  const process = options.meta?.process?.toUpperCase() ?? "UNKNOWN";

  return `${timestamp} [${logLevel}] [${process}] ${message} ${meta}`;
}

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

const LOG_MAX_SIZE = 1024 * 1024 * 10; // 10 MB
const timestamp = () => new Date().toISOString();
const fileFormatter = (options: unknown) => customFormatter(options as FormatOptions, false);
const consoleFormatter = (options: unknown) => customFormatter(options as FormatOptions, true);

function createFileTransport(basePath: string): winston.FileTransportInstance {
  return new winston.transports.File({
    filename: path.join(basePath, "vortex.log"),
    json: false,
    level: "debug",
    maxsize: LOG_MAX_SIZE,
    maxFiles: 5,
    tailable: true,
    timestamp: timestamp,
    formatter: fileFormatter,
  });
}

function setupLogger(basePath: string, useConsole: boolean): winston.LoggerInstance {
  const fileTransport = createFileTransport(basePath);

  const consoleTransport = useConsole
    ? new winston.transports.Console({
        level: "debug",
        timestamp: timestamp,
        formatter: consoleFormatter,
      })
    : undefined;

  const transports: winston.TransportInstance[] = [fileTransport];
  if (consoleTransport) {
    transports.push(consoleTransport);
  }

  const logger = new winston.Logger({
    level: "debug",
    transports,
  });

  return logger;
}

class LoggerSingleton {
  static #instance: winston.LoggerInstance | null = null;

  static initialize(instance: winston.LoggerInstance): winston.LoggerInstance {
    if (this.#instance) throw new Error("Already initialized");
    this.#instance = instance;
    return this.#instance;
  }

  static instance(): winston.LoggerInstance {
    if (!this.#instance) throw new Error("Not initialized yet");
    return this.#instance;
  }

  static log(level: Level, message: string, metadata?: unknown): void {
    // TODO: broken logging from tests
    if (!this.#instance) {
      console.log(`BROKEN LOGGING: ${level} ${message}`);
    } else {
      this.#instance.log(level, message, metadata);
    }
  }
}

/**
 * Once the process loses its console (the terminal that started it went away), every console
 * write fails with EPIPE. Unhandled, that error reaches the uncaught error handler, which logs
 * it, to the console again: an endless loop that fills the log folder by megabytes per second.
 * Dropping the console transport breaks the loop; the log file keeps working.
 */
export function dropConsoleOnBrokenPipe(
  logger: winston.LoggerInstance,
  streams: NodeJS.EventEmitter[] = [process.stdout, process.stderr],
): void {
  const onError = (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE" && logger.transports["console"] !== undefined) {
      logger.remove(winston.transports.Console);
    }
  };
  for (const stream of streams) {
    stream.on("error", onError);
  }
}

export function setupLogging(basePath: string, useConsole: boolean): void {
  const logger = LoggerSingleton.initialize(setupLogger(basePath, useConsole));
  dropConsoleOnBrokenPipe(logger);

  betterIpcMain.on("logging:log", (_, level, message, metadata) => {
    logger.log(level, message, {
      process: "renderer",
      extra: metadata,
    } satisfies Metadata);
  });
}

export function changeLogPath(newBasePath: string): void {
  const logger = LoggerSingleton.instance();

  logger.remove(winston.transports.File);
  logger.add(winston.transports.File, {
    filename: path.join(newBasePath, "vortex.log"),
    json: false,
    level: "debug",
    maxsize: LOG_MAX_SIZE,
    maxFiles: 5,
    tailable: true,
    timestamp: timestamp,
    formatter: fileFormatter,
  });
}

function sanitize(message: string): string {
  return message.replaceAll("%", "%%");
}

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export function log(level: Level, message: string, metadata?: unknown): void {
  const meta = metadata === undefined ? undefined : JSON.stringify(metadata, errorReplacer);
  const sanitized = sanitize(message);
  LoggerSingleton.log(level, sanitized, {
    process: "main",
    extra: meta,
  } satisfies Metadata);
}
