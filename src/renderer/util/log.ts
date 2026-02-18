import type { Level } from "../../shared/types/logging";
export type { Level as LogLevel } from "../../shared/types/logging";
import { log as rendererLog } from "../logging";

/** @deprecated Use log method from renderer directly */
export function log(level: Level, message: string, metadata?: unknown): void {
  rendererLog(level, message, metadata);
}
