/**
 * Type definitions for installation tracking.
 * Extracted from InstallManager.ts for better modularity.
 */

/**
 * Information about an active mod installation.
 * Used for tracking, debugging, and cleanup of stuck installs.
 */
export interface IActiveInstallation {
  /** Unique identifier for this installation operation */
  installId: string;
  /** ID of the source archive being installed */
  archiveId: string;
  /** Full path to the archive file */
  archivePath: string;
  /** ID of the mod being created/updated */
  modId: string;
  /** Game this mod is being installed for */
  gameId: string;
  /** Callback to invoke when installation completes or fails */
  callback: (error: Error | null, id: string) => void;
  /** Timestamp when installation started (for timeout detection) */
  startTime: number;
  /** Base name of the archive file (for display) */
  baseName: string;
}

/**
 * Information about a pending mod installation.
 * Used for tracking installs waiting for phase gating or concurrency limits.
 */
export interface IPendingInstallation {
  /** ID of the source archive */
  archiveId: string;
  /** ID of the mod (if known) */
  modId?: string;
  /** Phase number this install belongs to (for collections) */
  phase?: number;
  /** Callback to start the installation */
  start: () => void;
  /** Timestamp when the install was queued */
  queuedTime: number;
}

/**
 * Result of a replace/variant choice dialog.
 */
export interface IReplaceChoice {
  id: string;
  variant: string;
  enable: boolean;
  attributes: { [key: string]: any };
  rules: any[];
  replaceChoice: "replace" | "variant";
}

/**
 * Describes an invalid instruction found during validation.
 */
export interface IInvalidInstruction {
  type: string;
  error: string;
}
