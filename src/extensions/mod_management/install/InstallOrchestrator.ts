/**
 * InstallOrchestrator - Coordinates mod installation components.
 *
 * This class acts as a facade that owns and coordinates the extracted
 * installation components:
 * - InstallationTracker: Tracks active/pending installations
 * - PhaseManager: Manages phase state for collections
 * - ArchiveExtractor: Handles archive extraction
 * - InstructionProcessor: Validates and processes instructions
 *
 * InstallManager delegates to this orchestrator for core installation
 * operations while maintaining the public API.
 */

import Bluebird from "bluebird";
import Zip from "node-7z";

import { log } from "../../../util/log";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IMod, IModReference } from "../types/IMod";
import type { IInstruction } from "../types/IInstallResult";
import type { IDependency, Dependency } from "../types/IDependency";
import type { IActiveInstallation } from "./types/IInstallationEntry";
import type {
  IExtractionOptions,
  IExtractionResult,
} from "./types/IArchiveExtractor";

import { InstallationTracker } from "./InstallationTracker";
import { PhaseManager } from "./PhaseManager";
import { ArchiveExtractor } from "./ArchiveExtractor";
import { InstructionProcessor } from "./InstructionProcessor";
import { InstructionGroups } from "./InstructionGroups";
import {
  splitDependencies,
  isDependencyError,
  isDependency,
  logDependencyResults,
  type IDependencySplit,
} from "./DependencyResolver";

/**
 * Configuration for the InstallOrchestrator.
 */
export interface IInstallOrchestratorConfig {
  /** Maximum simultaneous main installations */
  maxSimultaneousInstalls: number;
  /** Maximum simultaneous dependency downloads */
  maxDependencyDownloads: number;
  /** Maximum dependency install retries */
  maxDependencyRetries: number;
  /** Notification aggregation timeout in ms */
  notificationAggregationMs: number;
}

/**
 * Default orchestrator configuration.
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: IInstallOrchestratorConfig = {
  maxSimultaneousInstalls: 5,
  maxDependencyDownloads: 10,
  maxDependencyRetries: 3,
  notificationAggregationMs: 5000,
};

/**
 * Result of splitting dependencies for installation.
 */
export interface IDependencySplitResult extends IDependencySplit {
  /** Context string for logging */
  context: string;
}

/**
 * Coordinates mod installation components.
 *
 * This class provides a unified interface for installation operations,
 * coordinating between the tracker, phase manager, extractor, and
 * instruction processor.
 */
export class InstallOrchestrator {
  private mTracker: InstallationTracker;
  private mPhaseManager: PhaseManager;
  private mExtractor: ArchiveExtractor;
  private mInstructionProcessor: InstructionProcessor;
  private mConfig: IInstallOrchestratorConfig;

  /**
   * Create a new InstallOrchestrator.
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<IInstallOrchestratorConfig>) {
    this.mConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.mTracker = new InstallationTracker();
    this.mPhaseManager = new PhaseManager();
    this.mExtractor = new ArchiveExtractor(new Zip());
    this.mInstructionProcessor = new InstructionProcessor();
  }

  // ==================== Component Access ====================
  // These methods provide access to the underlying components
  // for InstallManager during the transition period.

  /**
   * Get the installation tracker.
   */
  public getTracker(): InstallationTracker {
    return this.mTracker;
  }

  /**
   * Get the phase manager.
   */
  public getPhaseManager(): PhaseManager {
    return this.mPhaseManager;
  }

  /**
   * Get the archive extractor.
   */
  public getExtractor(): ArchiveExtractor {
    return this.mExtractor;
  }

  /**
   * Get the instruction processor.
   */
  public getInstructionProcessor(): InstructionProcessor {
    return this.mInstructionProcessor;
  }

  /**
   * Get the orchestrator configuration.
   */
  public getConfig(): Readonly<IInstallOrchestratorConfig> {
    return this.mConfig;
  }

  // ==================== Installation Tracking ====================

  /**
   * Register a new installation.
   * @param installId - Unique installation ID
   * @param info - Installation information
   */
  public registerInstallation(
    installId: string,
    info: IActiveInstallation,
  ): void {
    this.mTracker.setActive(installId, info);
    log("debug", "Orchestrator: registered installation", {
      installId,
      archiveId: info.archiveId,
      baseName: info.baseName,
    });
  }

  /**
   * Complete an installation (success or failure).
   * @param installId - Installation ID
   * @param modId - Resulting mod ID (if successful)
   * @param error - Error if installation failed
   */
  public completeInstallation(
    installId: string,
    modId?: string,
    error?: Error,
  ): void {
    const activeInstall = this.mTracker.getActive(installId);
    if (activeInstall) {
      if (modId) {
        activeInstall.modId = modId;
      }
      log(error ? "warn" : "info", "Orchestrator: installation completed", {
        installId,
        modId: modId || activeInstall.modId,
        duration: Date.now() - activeInstall.startTime,
        success: !error,
        error: error?.message,
      });
    }
    this.mTracker.deleteActive(installId);
  }

  /**
   * Check if an installation is currently active.
   */
  public isInstallationActive(installId: string): boolean {
    return this.mTracker.hasActive(installId);
  }

  /**
   * Get all active installations.
   */
  public getActiveInstallations(): IActiveInstallation[] {
    return this.mTracker.getActiveInstallations();
  }

  /**
   * Get the count of active installations.
   */
  public getActiveInstallationCount(): number {
    return this.mTracker.getActiveCount();
  }

  // ==================== Phase Management ====================

  /**
   * Initialize phase tracking for a collection installation.
   * @param sourceModId - The collection's mod ID
   */
  public initializePhaseTracking(sourceModId: string): void {
    this.mPhaseManager.ensureState(sourceModId);
    log("debug", "Orchestrator: initialized phase tracking", { sourceModId });
  }

  /**
   * Check if phase tracking is active for a collection.
   */
  public hasPhaseTracking(sourceModId: string): boolean {
    return this.mPhaseManager.hasState(sourceModId);
  }

  /**
   * Clean up phase tracking for a collection.
   */
  public cleanupPhaseTracking(sourceModId: string): void {
    // Clean up tracker entries for this source mod
    const trackerCleanup = this.mTracker.cleanupForSourceMod(sourceModId);

    // Delete phase state
    this.mPhaseManager.deleteState(sourceModId);

    log("debug", "Orchestrator: cleaned up phase tracking", {
      sourceModId,
      ...trackerCleanup,
    });
  }

  /**
   * Check if a phase can start installing.
   * @param sourceModId - The collection's mod ID
   * @param phase - The phase number to check
   */
  public canInstallPhase(sourceModId: string, phase: number): boolean {
    const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
    const isDeploying = this.mPhaseManager.isDeploying(sourceModId);

    // Can install if:
    // 1. Phase matches allowed phase (or allowed is undefined for first install)
    // 2. Not currently deploying
    return (
      (allowedPhase === undefined || phase <= allowedPhase) && !isDeploying
    );
  }

  // ==================== Archive Extraction ====================

  /**
   * Extract an archive to the specified destination.
   * @param archivePath - Path to the archive
   * @param destPath - Destination directory
   * @param options - Extraction options
   */
  public extractArchive(
    archivePath: string,
    destPath: string,
    options?: IExtractionOptions,
  ): Bluebird<IExtractionResult> {
    log("debug", "Orchestrator: extracting archive", {
      archivePath,
      destPath,
    });
    return this.mExtractor.extract(archivePath, destPath, options);
  }

  // ==================== Instruction Processing ====================

  /**
   * Validate installation instructions.
   * @param instructions - Instructions to validate
   * @returns Array of invalid instructions (empty if all valid)
   */
  public validateInstructions(
    instructions: IInstruction[],
  ): Array<{ type: string; error: string }> {
    return this.mInstructionProcessor.validateInstructions(instructions);
  }

  /**
   * Transform instructions into grouped format.
   * @param instructions - Raw instructions
   * @returns Grouped instructions
   */
  public transformInstructions(
    instructions: IInstruction[],
  ): InstructionGroups {
    return this.mInstructionProcessor.transformInstructions(instructions);
  }

  /**
   * Check if instruction groups contain errors.
   */
  public hasInstructionErrors(groups: InstructionGroups): boolean {
    return this.mInstructionProcessor.hasErrors(groups);
  }

  /**
   * Get error messages from instruction groups.
   */
  public getInstructionErrors(groups: InstructionGroups): string[] {
    return this.mInstructionProcessor.getErrorMessages(groups);
  }

  // ==================== Dependency Resolution ====================

  /**
   * Split dependencies into categories for installation.
   *
   * @param dependencies - Dependencies to categorize
   * @param isModEnabled - Function to check if a mod is enabled
   * @param testModMatch - Function to test if a mod matches a reference
   * @param context - Context string for logging
   * @returns Categorized dependencies
   */
  public splitDependencies(
    dependencies: Dependency[],
    isModEnabled: (modId: string) => boolean,
    testModMatch: (mod: IMod, reference: IModReference) => boolean | string,
    context: string = "orchestrator",
  ): IDependencySplitResult {
    const result = splitDependencies(dependencies, isModEnabled, testModMatch);
    logDependencyResults(result, context);
    return { ...result, context };
  }

  /**
   * Check if a dependency result is an error.
   */
  public isDependencyError(dep: Dependency): boolean {
    return isDependencyError(dep);
  }

  /**
   * Check if a dependency result is a valid dependency.
   */
  public isDependency(dep: Dependency): dep is IDependency {
    return isDependency(dep);
  }

  // ==================== Cleanup ====================

  /**
   * Force cleanup of stuck installations.
   * @param api - Extension API for notifications
   * @param maxAgeMinutes - Max age before cleanup
   * @returns Number of cleaned up installations
   */
  public forceCleanupStuckInstalls(
    api: IExtensionApi,
    maxAgeMinutes: number = 10,
  ): number {
    return this.mTracker.forceCleanupStuckInstalls(api, maxAgeMinutes);
  }

  /**
   * Get debug information about the orchestrator state.
   */
  public debugState(): {
    tracker: ReturnType<InstallationTracker["debugSummary"]>;
    config: IInstallOrchestratorConfig;
  } {
    return {
      tracker: this.mTracker.debugSummary(),
      config: this.mConfig,
    };
  }
}
