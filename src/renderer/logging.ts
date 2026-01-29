import type { Level } from "@shared/types/logging";

export function log(level: Level, message: string, metadata?: unknown) {
  const meta = metadata === undefined ? undefined : JSON.stringify(metadata);
  window.api.log(level, message, meta);
}
