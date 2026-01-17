/**
 * Mod installation utilities - extracted from InstallManager.ts
 * for better modularity and testability.
 */

export { InstructionGroups } from "./InstructionGroups";
export {
  findDownloadByReferenceTag,
  getReadyDownloadId,
  getModsByPhase,
  filterDependencyRules,
} from "./helpers";

// Re-export types
export type {
  IPhaseState,
  IDeploymentDetails,
  IDownloadLookupCache,
  IInstallConfig,
  IActiveInstallation,
  IPendingInstallation,
  IReplaceChoice,
  IInvalidInstruction,
} from "./types";
export {
  createPhaseState,
  DEFAULT_INSTALL_CONFIG,
  ARCHIVE_EXTENSIONS,
  FILETYPES_AVOID,
} from "./types";

// Re-export error classification utilities
export {
  isBrowserAssistantError,
  isFileInUse,
  isCritical,
  classifyError,
} from "./errors";
export type { ErrorSeverity } from "./errors";

// Re-export InstallationTracker
export { InstallationTracker } from "./InstallationTracker";
export type { IActiveInstallDebugInfo } from "./InstallationTracker";

// Re-export PhaseManager
export { PhaseManager } from "./PhaseManager";
export type { IPhaseAdvanceCheck, IPhaseStats } from "./PhaseManager";

// Re-export ArchiveExtractor
export { ArchiveExtractor } from "./ArchiveExtractor";
export type {
  IExtractionResult,
  IExtractionOptions,
  IArchiveExtractorConfig,
  ExtractionProgressCallback,
  PasswordQueryCallback,
} from "./types/IArchiveExtractor";
export { DEFAULT_EXTRACTOR_CONFIG } from "./types/IArchiveExtractor";
