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

// Re-export InstructionProcessor
export {
  InstructionProcessor,
  validateInstructions,
  transformInstructions,
} from "./InstructionProcessor";
export type { IIniEditConfig } from "./InstructionProcessor";
export { DEFAULT_INI_CONFIG } from "./InstructionProcessor";

// Re-export DependencyResolver utilities
export {
  isDependencyError,
  isDependency,
  splitDependencies,
  filterProcessingDependencies,
  groupDependenciesByPhase,
  getPhases,
  countDependencies,
  isPhaseComplete,
  getReadyToInstall,
  getNeedingDownload,
  createProgressTracker,
  summarizeErrors,
  logDependencyResults,
} from "./DependencyResolver";
export type {
  IDependencyError,
  DependencyResult,
  IDependencySplit,
  DependencyProgressCallback,
  IDependencyResolveOptions,
} from "./DependencyResolver";

// Re-export InstallOrchestrator
export { InstallOrchestrator } from "./InstallOrchestrator";
export type {
  IInstallOrchestratorConfig,
  IDependencySplitResult,
} from "./InstallOrchestrator";
export { DEFAULT_ORCHESTRATOR_CONFIG } from "./InstallOrchestrator";

// Re-export UserDialogManager
export {
  UserDialogManager,
  validateVariantName,
  INSTALL_ACTION,
  REPLACE_ACTION,
} from "./UserDialogManager";
export type { IInstallDialogOptions } from "./UserDialogManager";

// Re-export ModLookupService
export {
  ModLookupService,
  hasFuzzyReference,
  checkModVariantsExist,
  checkModNameExists,
  findPreviousVersionMod,
  findDownloadForMod,
} from "./ModLookupService";

// Re-export InstallerSelector
export {
  InstallerSelector,
  getInstaller,
  determineModType,
  deriveInstallName,
  reportUnsupported,
} from "./InstallerSelector";

// Re-export DependencyInstaller
export {
  DependencyInstaller,
  showMemoDialog,
  installRecommendationsQueryMain,
  installRecommendationsQuerySelect,
  updateModRule,
  updateRules,
} from "./DependencyInstaller";

// Re-export DownloadEventHandler
export {
  DownloadEventHandler,
  findCollectionByDownload,
} from "./DownloadEventHandler";
export type {
  ICollectionDownloadInfo,
  IDownloadEventCallbacks,
} from "./DownloadEventHandler";

// Re-export DependencyDownloader
export {
  DependencyDownloader,
  downloadURL,
  downloadMatching,
  downloadDependencyAsync,
} from "./DependencyDownloader";

// Re-export DependencyPhaseHelpers
export { applyExtraFromRule, dropUnfulfilled } from "./DependencyPhaseHelpers";

// Re-export PhasedInstallCoordinator
export {
  PhasedInstallCoordinator,
  checkCollectionPhaseStatus,
  canStartInstallationTasks,
} from "./PhasedInstallCoordinator";
export type { IPhaseStatusResult } from "./PhasedInstallCoordinator";

// Re-export InstructionDispatcher
export {
  InstructionDispatcher,
  processAttribute,
  processEnableAllPlugins,
  processSetModType,
  processRule,
} from "./InstructionDispatcher";
export type { IModTypeContext } from "./InstructionDispatcher";

// Re-export PhaseCoordinator
export {
  PhaseCoordinator,
  DEFAULT_PHASE_COORDINATOR_CONFIG,
} from "./PhaseCoordinator";
export type {
  IPhaseCoordinatorCallbacks,
  IPhaseCoordinatorConfig,
} from "./PhaseCoordinator";

// Re-export InstallationQueueManager
export {
  InstallationQueueManager,
  DEFAULT_QUEUE_CONFIG,
} from "./InstallationQueueManager";
export type {
  IInstallationQueueCallbacks,
  IInstallationQueueConfig,
} from "./InstallationQueueManager";
