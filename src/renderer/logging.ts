import type { Level } from "@shared/types/logging";

export function log(level: Level, message: string, metadata?: unknown) {
  const meta = metadata === undefined ? undefined : JSON.stringify(metadata);
  if (!window.api) {
    // window.api not yet available (preload hasn't run), fall back to console
    console.log(`[${level.toUpperCase()}] ${message}`, meta ?? "");
    return;
  }
  window.api.log(level, message, meta);
}
