/**
 * Error classification utilities for mod installation.
 * Extracted from InstallManager.ts for better modularity.
 *
 * These functions classify errors based on string pattern matching.
 * Future improvement: Convert to typed error classes for better reliability.
 */

/**
 * Check if an error is caused by Browser Assistant anti-virus.
 * This is a Windows-specific false positive that can be safely ignored.
 */
export function isBrowserAssistantError(error: string): boolean {
  return (
    process.platform === "win32" &&
    error.indexOf("Roaming\\Browser Assistant") !== -1
  );
}

/**
 * Check if an error indicates the file is in use by another process.
 * These errors are typically retryable.
 */
export function isFileInUse(error: string): boolean {
  return (
    error.indexOf("being used by another process") !== -1 ||
    error.indexOf("locked by another process") !== -1
  );
}

/**
 * Check if an error is critical (archive is broken/corrupt).
 * Critical errors should not be retried as they indicate permanent problems.
 *
 * File-in-use errors are explicitly excluded as they are retryable.
 */
export function isCritical(error: string): boolean {
  // Don't treat file-in-use errors as critical - they can be retried
  if (isFileInUse(error)) {
    return false;
  }
  return (
    error.indexOf("Unexpected end of archive") !== -1 ||
    error.indexOf("ERROR: Data Error") !== -1 ||
    // used to be "Can not", current 7z prints "Cannot"
    error.indexOf("Cannot open the file as archive") !== -1 ||
    error.indexOf("Can not open the file as archive") !== -1
  );
}

/**
 * Error severity levels for installation errors.
 */
export type ErrorSeverity = "critical" | "retryable" | "ignorable";

/**
 * Classify an error by its severity.
 */
export function classifyError(error: string): ErrorSeverity {
  if (isBrowserAssistantError(error)) {
    return "ignorable";
  }
  if (isFileInUse(error)) {
    return "retryable";
  }
  if (isCritical(error)) {
    return "critical";
  }
  // Default to retryable for unknown errors
  return "retryable";
}
