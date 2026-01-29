import type { LogLevel } from "@shared/types/logging";

export function log(level: LogLevel, message: string, metadata?: unknown) {
  const meta = metadata ? JSON.stringify(metadata) : undefined;
  window.api.log(level, message, meta);
}
