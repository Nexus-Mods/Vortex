/**
 * Type definitions for mod installation.
 */

export type {
  IPhaseState,
  IDeploymentDetails,
  IDownloadLookupCache,
} from "./IPhaseState";
export { createPhaseState } from "./IPhaseState";

export type { IInstallConfig } from "./IInstallConfig";
export {
  DEFAULT_INSTALL_CONFIG,
  ARCHIVE_EXTENSIONS,
  FILETYPES_AVOID,
} from "./IInstallConfig";

export type {
  IActiveInstallation,
  IPendingInstallation,
  IReplaceChoice,
  IInvalidInstruction,
} from "./IInstallationEntry";

export type {
  IExtractionResult,
  IExtractionOptions,
  IArchiveExtractorConfig,
  ExtractionProgressCallback,
  PasswordQueryCallback,
} from "./IArchiveExtractor";
export { DEFAULT_EXTRACTOR_CONFIG } from "./IArchiveExtractor";
