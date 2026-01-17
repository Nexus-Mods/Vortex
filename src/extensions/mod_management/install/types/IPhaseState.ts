/**
 * Type definitions for phase-gated collection installation state.
 * Extracted from InstallManager.ts for better modularity.
 */

/**
 * Cache for download lookups to avoid O(n*m) complexity.
 */
export interface IDownloadLookupCache {
  byTag: Map<string, string>;
  byMd5: Map<string, string>;
}

/**
 * Details about a deployment operation in progress.
 */
export interface IDeploymentDetails {
  deploymentPromise: Promise<void>;
  deployOnSettle: boolean;
}

/**
 * State tracking for a single collection's phase-gated installation.
 *
 * Phase installation follows these invariants:
 * 1. Only one phase can be active at a time (allowedPhase)
 * 2. A phase cannot advance until deployment completes (isDeploying)
 * 3. Active and pending counts must both reach 0 before phase advances
 * 4. After deployment, startPendingForPhase must be called to resume queued installs
 */
export interface IPhaseState {
  /**
   * Current phase that is allowed to install.
   * undefined means phase tracking hasn't started yet.
   */
  allowedPhase?: number;

  /**
   * Set of phase numbers where all downloads have completed.
   */
  downloadsFinished: Set<number>;

  /**
   * Map of phase number to queued installation callbacks.
   * Installations are queued when their phase isn't allowed yet.
   */
  pendingByPhase: Map<number, Array<() => void>>;

  /**
   * Map of phase number to count of currently active installations.
   */
  activeByPhase: Map<number, number>;

  /**
   * Set of phase numbers that have completed deployment.
   */
  deployedPhases: Set<number>;

  /**
   * Tracks re-queue attempts per phase to prevent infinite loops.
   */
  reQueueAttempted?: Map<number, number>;

  /**
   * Map of phase number to deployment promise details.
   */
  deploymentPromises?: Map<number, IDeploymentDetails>;

  /**
   * CRITICAL: Flag indicating deployment is in progress.
   * When true, new installations must be queued, not started.
   */
  isDeploying?: boolean;

  /**
   * Performance optimization: cache download lookups.
   */
  downloadLookupCache?: IDownloadLookupCache;
}

/**
 * Creates a new empty phase state with default values.
 */
export function createPhaseState(): IPhaseState {
  return {
    allowedPhase: undefined,
    downloadsFinished: new Set<number>(),
    pendingByPhase: new Map<number, Array<() => void>>(),
    activeByPhase: new Map<number, number>(),
    deployedPhases: new Set<number>(),
    deploymentPromises: new Map<number, IDeploymentDetails>(),
    downloadLookupCache: {
      byTag: new Map<string, string>(),
      byMd5: new Map<string, string>(),
    },
  };
}
