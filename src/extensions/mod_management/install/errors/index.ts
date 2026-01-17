/**
 * Error classification and handling for mod installation.
 */

export {
  isBrowserAssistantError,
  isFileInUse,
  isCritical,
  classifyError,
} from "./errorClassification";
export type { ErrorSeverity } from "./errorClassification";
