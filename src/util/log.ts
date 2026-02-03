import type { Level } from "../shared/types/logging";
export type { Level as LogLevel } from "../shared/types/logging";

// NOTE(erri120): This is a hack but the only way to make it work without massively refactoring everything else
// TODO: remove after main/renderer separation

function logInRenderer(level: Level, message: string, metadata?: unknown) {
  const logging = require("../renderer/logging");
  logging.log(level, message, metadata);
}

function logInMain(level: Level, message: string, metadata?: unknown) {
  const logging = require("../main/logging");
  logging.log(level, message, metadata);
}

/** @deprecated Use log method from renderer or main directly */
export function log(level: Level, message: string, metadata?: unknown): void {
  if (process.type === "renderer") {
    logInRenderer(level, message, metadata);
  } else {
    logInMain(level, message, metadata);
  }
}
