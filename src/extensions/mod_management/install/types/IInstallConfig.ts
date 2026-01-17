/**
 * Configuration constants for mod installation.
 * Extracted from InstallManager.ts to eliminate magic numbers.
 */

/**
 * Configuration for installation concurrency and timing.
 */
export interface IInstallConfig {
  concurrency: {
    /** Maximum number of simultaneous mod installations. Default: 5 */
    maxSimultaneousInstalls: number;
    /** Maximum number of concurrent dependency installations. Default: 10 */
    maxDependencyInstalls: number;
    /** Maximum number of concurrent dependency downloads. Default: 10 */
    maxDependencyDownloads: number;
    /** Maximum retry attempts for failed dependency installs. Default: 3 */
    maxRetries: number;
  };
  timing: {
    /** Notification aggregation window in milliseconds. Default: 5000 */
    notificationAggregationMs: number;
    /** Delay between retry attempts in milliseconds. Default: 1000 */
    retryDelayMs: number;
    /** Poll interval for phase settlement (deprecated, use events). Default: 500 */
    pollIntervalMs: number;
    /** Delay for concurrency limiter to recheck slots. Default: 100 */
    concurrencyRecheckMs: number;
    /** Delay for concurrency limiter when no slots available. Default: 500 */
    concurrencyWaitMs: number;
  };
  cleanup: {
    /** Maximum age in minutes for stuck installation cleanup. Default: 10 */
    stuckInstallMaxAgeMinutes: number;
  };
}

/**
 * Default installation configuration.
 */
export const DEFAULT_INSTALL_CONFIG: IInstallConfig = {
  concurrency: {
    maxSimultaneousInstalls: 5,
    maxDependencyInstalls: 10,
    maxDependencyDownloads: 10,
    maxRetries: 3,
  },
  timing: {
    notificationAggregationMs: 5000,
    retryDelayMs: 1000,
    pollIntervalMs: 500,
    concurrencyRecheckMs: 100,
    concurrencyWaitMs: 500,
  },
  cleanup: {
    stuckInstallMaxAgeMinutes: 10,
  },
};

/**
 * Archive file extensions supported for extraction.
 */
export const ARCHIVE_EXTENSIONS = new Set<string>([
  ".zip",
  ".z01",
  ".7z",
  ".rar",
  ".r00",
  ".001",
  ".bz2",
  ".bzip2",
  ".gz",
  ".gzip",
  ".xz",
  ".z",
  ".lzh",
]);

/**
 * File types that 7z supports but we don't want to extract.
 */
export const FILETYPES_AVOID = [".dll"];
