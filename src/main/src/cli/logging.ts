import type { Level } from "@vortex/shared";

export function setupLogging(_basePath: string, _useConsole: boolean): void {
  // no-op in CLI mode
}

export function changeLogPath(_newBasePath: string): void {
  // no-op in CLI mode
}

export function log(level: Level, message: string, metadata?: unknown): void {
  const meta = metadata !== undefined ? ` ${JSON.stringify(metadata)}` : "";
  process.stderr.write(`[${level.toUpperCase()}] ${message}${meta}\n`);
}
