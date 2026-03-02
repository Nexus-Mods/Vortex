import type { Level } from "@vortex/shared";

import path from "path";
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
    ? winston.config.colorize(
        options.level as unknown as number,
        formattedLogLevel,
      )
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

const timestamp = () => new Date().toISOString();
const fileFormatter = (options: unknown) =>
  customFormatter(options as FormatOptions, false);
const consoleFormatter = (options: unknown) =>
  customFormatter(options as FormatOptions, true);

function createFileTransport(basePath: string): winston.FileTransportInstance {
  return new winston.transports.File({
    filename: path.join(basePath, "vortex.log"),
    json: false,
    level: "debug",
    maxsize: 1024 * 1024,
    maxFiles: 5,
    tailable: true,
    timestamp: timestamp,
    formatter: fileFormatter,
  });
}

function setupLogger(
  basePath: string,
  useConsole: boolean,
): winston.LoggerInstance {
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

export function setupLogging(basePath: string, useConsole: boolean): void {
  const logger = LoggerSingleton.initialize(setupLogger(basePath, useConsole));

  betterIpcMain.on("logging:log", (_, level, message, metadata) => {
    logger.log(level, message, {
      process: "renderer",
      extra: metadata,
    } satisfies Metadata);
  });
}

export function changeLogPath(newBasePath: string): void {
  const logger = LoggerSingleton.instance();
  const fileTransport = createFileTransport(newBasePath);

  logger.remove(winston.transports.File);
  logger.add(fileTransport);
}

function sanitize(message: string): string {
  return message.replaceAll("%", "%%");
}

export function log(level: Level, message: string, metadata?: unknown): void {
  const meta = metadata === undefined ? undefined : JSON.stringify(metadata);
  const sanitized = sanitize(message);
  LoggerSingleton.log(level, sanitized, {
    process: "main",
    extra: meta,
  } satisfies Metadata);
}
