/**
 * Analytics extension logging utility
 * Provides consistent logging prefixes for all analytics-related components
 */

import type { LogLevel } from "../../../renderer/util/log";
import { log } from "../../../renderer/util/log";

/**
 * Log function specifically for analytics extension components
 * Automatically prefixes all log messages with [ANALYTICS]
 *
 * @param level Log level
 * @param message Log message
 * @param metadata Optional metadata object
 */
export function analyticsLog(level: LogLevel, message: string, metadata?: any) {
  log(level, `[ANALYTICS] ${message}`, metadata);
}

/**
 * Log function for specific analytics services (e.g., Mixpanel, GA4)
 * Prefixes with [ANALYTICS:SERVICE]
 *
 * @param service Service name (e.g., 'mixpanel', 'ga4')
 * @param level Log level
 * @param message Log message
 * @param metadata Optional metadata object
 */
export function analyticsServiceLog(
  service: string,
  level: LogLevel,
  message: string,
  metadata?: any,
) {
  log(level, `[ANALYTICS:${service.toUpperCase()}] ${message}`, metadata);
}
