import type { Level } from "@vortex/shared";
export type { Level as LogLevel } from "@vortex/shared";
import { log as rendererLog } from "../logging";

/** @deprecated Use log method from renderer directly */
export function log(level: Level, message: string, metadata?: unknown): void {
  rendererLog(level, message, metadata);
}
