/**
 * PhaseManager - Manages phase-gated collection installations.
 * Extracted from InstallManager.ts for better modularity.
 *
 * ## Critical Invariants (See AGENTS-COLLECTIONS.md)
 *
 * 1. DEPLOYMENT BLOCKING: When `isDeploying` is true, new installations must be queued.
 *    Removing this check causes race conditions with file conflicts.
 *
 * 2. PHASE COMPLETION CHECK: Both `activeByPhase.get(phase) === 0` AND
 *    `pendingByPhase.get(phase).length === 0` must be true before phase can advance.
 *
 * 3. PHASE GATING: Even optional/recommended mods must wait for their phase.
 *    Never bypass phase gating - it breaks last-phase advancement logic.
 *
 * 4. POST-DEPLOYMENT: Always call `startPendingForPhase()` after deployment
 *    completes to resume any installations that were queued during deployment.
 */

import { log } from "../../../util/log";
import type { IPhaseState, IDeploymentDetails } from "./types/IPhaseState";

/**
 * Result of checking if a phase can advance.
 */
export interface IPhaseAdvanceCheck {
  canAdvance: boolean;
  reason: string;
  currentPhase: number;
  nextPhase?: number;
}

/**
 * Statistics about a phase's installation state.
 */
export interface IPhaseStats {
  activeCount: number;
  pendingCount: number;
  downloadsFinished: boolean;
  isDeployed: boolean;
}

/**
 * Manages phase state for collection installations.
 *
 * Each collection installation has its own phase state tracked by sourceModId.
 * Phases must be processed in order: all installs for phase N must complete
 * and be deployed before phase N+1 can start.
 */
export class PhaseManager {
  // Map tracking phase state per source mod/collection
  private mPhaseStates: Map<string, IPhaseState> = new Map();

  /**
   * Initialize or ensure phase state exists for a source mod.
   */
  public ensureState(sourceModId: string): void {
    if (!this.mPhaseStates.has(sourceModId)) {
      this.mPhaseStates.set(sourceModId, {
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
      });
    }
  }

  /**
   * Get the phase state for a source mod.
   */
  public getState(sourceModId: string): IPhaseState | undefined {
    return this.mPhaseStates.get(sourceModId);
  }

  /**
   * Check if phase state exists for a source mod.
   */
  public hasState(sourceModId: string): boolean {
    return this.mPhaseStates.has(sourceModId);
  }

  /**
   * Delete phase state for a source mod.
   */
  public deleteState(sourceModId: string): void {
    this.mPhaseStates.delete(sourceModId);
  }

  // ==================== Phase Tracking ====================

  /**
   * Get the currently allowed phase.
   */
  public getAllowedPhase(sourceModId: string): number | undefined {
    return this.mPhaseStates.get(sourceModId)?.allowedPhase;
  }

  /**
   * Set the allowed phase.
   */
  public setAllowedPhase(sourceModId: string, phase: number): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    state.allowedPhase = phase;
  }

  /**
   * Check if a specific phase has had its downloads finished.
   */
  public hasDownloadsFinished(sourceModId: string, phase: number): boolean {
    return (
      this.mPhaseStates.get(sourceModId)?.downloadsFinished.has(phase) ?? false
    );
  }

  /**
   * Mark a phase's downloads as finished.
   */
  public markDownloadsFinished(sourceModId: string, phase: number): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    state.downloadsFinished.add(phase);

    // Initialize allowed phase to the first finished phase if not set
    if (state.allowedPhase === undefined) {
      state.allowedPhase = phase;
      // Mark all previous phases as downloads finished since we can't be
      // in phase N without having completed phases 0 through N-1
      for (let p = 0; p < phase; p++) {
        state.downloadsFinished.add(p);
      }
    }
  }

  /**
   * Get all finished phases sorted in order.
   */
  public getFinishedPhases(sourceModId: string): number[] {
    const state = this.mPhaseStates.get(sourceModId);
    if (!state) return [];
    return Array.from(state.downloadsFinished).sort((a, b) => a - b);
  }

  // ==================== Deployment Tracking ====================

  /**
   * Check if a phase has been deployed.
   */
  public isPhaseDeployed(sourceModId: string, phase: number): boolean {
    return (
      this.mPhaseStates.get(sourceModId)?.deployedPhases.has(phase) ?? false
    );
  }

  /**
   * Mark a phase as deployed.
   */
  public markPhaseDeployed(sourceModId: string, phase: number): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    state.deployedPhases.add(phase);
  }

  /**
   * Check if deployment is currently in progress.
   */
  public isDeploying(sourceModId: string): boolean {
    return this.mPhaseStates.get(sourceModId)?.isDeploying ?? false;
  }

  /**
   * Set the deploying flag.
   * CRITICAL: When true, new installations must be queued, not started.
   */
  public setDeploying(sourceModId: string, deploying: boolean): void {
    const state = this.mPhaseStates.get(sourceModId);
    if (state) {
      state.isDeploying = deploying;
    }
  }

  // ==================== Deployment Promises ====================

  /**
   * Get an existing deployment promise for a phase.
   */
  public getDeploymentPromise(
    sourceModId: string,
    phase: number,
  ): IDeploymentDetails | undefined {
    return this.mPhaseStates.get(sourceModId)?.deploymentPromises?.get(phase);
  }

  /**
   * Set a deployment promise for a phase.
   */
  public setDeploymentPromise(
    sourceModId: string,
    phase: number,
    details: IDeploymentDetails,
  ): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    if (!state.deploymentPromises) {
      state.deploymentPromises = new Map<number, IDeploymentDetails>();
    }
    state.deploymentPromises.set(phase, details);
  }

  /**
   * Remove a deployment promise for a phase.
   */
  public deleteDeploymentPromise(sourceModId: string, phase: number): void {
    const state = this.mPhaseStates.get(sourceModId);
    state?.deploymentPromises?.delete(phase);
  }

  // ==================== Active/Pending Tracking ====================

  /**
   * Increment active installation count for a phase.
   */
  public incrementActive(sourceModId: string, phase: number): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    const current = state.activeByPhase.get(phase) ?? 0;
    state.activeByPhase.set(phase, current + 1);
  }

  /**
   * Decrement active installation count for a phase.
   */
  public decrementActive(sourceModId: string, phase: number): void {
    const state = this.mPhaseStates.get(sourceModId);
    if (state) {
      const current = state.activeByPhase.get(phase) ?? 0;
      state.activeByPhase.set(phase, Math.max(0, current - 1));
    }
  }

  /**
   * Get active installation count for a phase.
   */
  public getActiveCount(sourceModId: string, phase: number): number {
    return this.mPhaseStates.get(sourceModId)?.activeByPhase.get(phase) ?? 0;
  }

  /**
   * Queue a pending installation callback for a phase.
   */
  public queuePending(
    sourceModId: string,
    phase: number,
    callback: () => void,
  ): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    let pending = state.pendingByPhase.get(phase);
    if (!pending) {
      pending = [];
      state.pendingByPhase.set(phase, pending);
    }
    pending.push(callback);
  }

  /**
   * Get and clear pending installation callbacks for a phase.
   */
  public drainPending(sourceModId: string, phase: number): Array<() => void> {
    const state = this.mPhaseStates.get(sourceModId);
    if (!state) return [];
    const tasks = state.pendingByPhase.get(phase) ?? [];
    state.pendingByPhase.set(phase, []);
    return tasks;
  }

  /**
   * Get pending count for a phase.
   */
  public getPendingCount(sourceModId: string, phase: number): number {
    return (
      this.mPhaseStates.get(sourceModId)?.pendingByPhase.get(phase)?.length ?? 0
    );
  }

  // ==================== Re-queue Tracking ====================

  /**
   * Check if re-queue was attempted for a phase.
   */
  public hasReQueueAttempted(sourceModId: string, phase: number): boolean {
    return (
      this.mPhaseStates.get(sourceModId)?.reQueueAttempted?.has(phase) ?? false
    );
  }

  /**
   * Mark that re-queue was attempted for a phase.
   */
  public markReQueueAttempted(sourceModId: string, phase: number): void {
    this.ensureState(sourceModId);
    const state = this.mPhaseStates.get(sourceModId);
    if (!state.reQueueAttempted) {
      state.reQueueAttempted = new Map<number, number>();
    }
    const current = state.reQueueAttempted.get(phase) ?? 0;
    state.reQueueAttempted.set(phase, current + 1);
  }

  /**
   * Get re-queue attempt count for a phase.
   */
  public getReQueueAttemptCount(sourceModId: string, phase: number): number {
    return (
      this.mPhaseStates.get(sourceModId)?.reQueueAttempted?.get(phase) ?? 0
    );
  }

  /**
   * Clear re-queue attempts for phases beyond the allowed phase.
   */
  public clearFutureReQueueAttempts(sourceModId: string): void {
    const state = this.mPhaseStates.get(sourceModId);
    if (!state?.reQueueAttempted || state.allowedPhase === undefined) return;

    const allowedPhase = state.allowedPhase;
    Array.from(state.reQueueAttempted.keys()).forEach((phase) => {
      if (phase > allowedPhase) {
        state.reQueueAttempted.delete(phase);
        log("debug", "Cleared re-queue attempt for future phase", {
          sourceModId,
          phase,
          allowedPhase,
        });
      }
    });
  }

  // ==================== Download Lookup Cache ====================

  /**
   * Get download ID from cache by tag.
   */
  public getCachedDownloadByTag(
    sourceModId: string,
    tag: string,
  ): string | undefined {
    return this.mPhaseStates
      .get(sourceModId)
      ?.downloadLookupCache?.byTag.get(tag);
  }

  /**
   * Get download ID from cache by MD5.
   */
  public getCachedDownloadByMd5(
    sourceModId: string,
    md5: string,
  ): string | undefined {
    return this.mPhaseStates
      .get(sourceModId)
      ?.downloadLookupCache?.byMd5.get(md5);
  }

  /**
   * Cache a download ID by tag.
   */
  public cacheDownloadByTag(
    sourceModId: string,
    tag: string,
    downloadId: string,
  ): void {
    const state = this.mPhaseStates.get(sourceModId);
    state?.downloadLookupCache?.byTag.set(tag, downloadId);
  }

  /**
   * Cache a download ID by MD5.
   */
  public cacheDownloadByMd5(
    sourceModId: string,
    md5: string,
    downloadId: string,
  ): void {
    const state = this.mPhaseStates.get(sourceModId);
    state?.downloadLookupCache?.byMd5.set(md5, downloadId);
  }

  // ==================== Phase Advancement Logic ====================

  /**
   * Check if a phase can potentially advance.
   * This is a lightweight check that doesn't verify collection status.
   */
  public canPhaseAdvance(sourceModId: string): IPhaseAdvanceCheck {
    const state = this.mPhaseStates.get(sourceModId);
    if (!state) {
      return { canAdvance: false, reason: "No phase state", currentPhase: -1 };
    }

    if (state.allowedPhase === undefined) {
      return {
        canAdvance: false,
        reason: "Awaiting first finished phase",
        currentPhase: -1,
      };
    }

    const phase = state.allowedPhase;
    const active = state.activeByPhase.get(phase) ?? 0;
    const pending = state.pendingByPhase.get(phase)?.length ?? 0;
    const downloadsFinished = state.downloadsFinished.has(phase);
    const isDeployed = state.deployedPhases.has(phase);

    if (!downloadsFinished) {
      return {
        canAdvance: false,
        reason: "Downloads not finished",
        currentPhase: phase,
      };
    }

    if (active > 0) {
      return {
        canAdvance: false,
        reason: `${active} active installations`,
        currentPhase: phase,
      };
    }

    if (pending > 0) {
      return {
        canAdvance: false,
        reason: `${pending} pending installations`,
        currentPhase: phase,
      };
    }

    if (!isDeployed) {
      return {
        canAdvance: false,
        reason: "Phase not deployed",
        currentPhase: phase,
      };
    }

    // Find next phase
    const finished = this.getFinishedPhases(sourceModId);
    const currIdx = finished.indexOf(phase);
    const nextIdx = currIdx + 1;

    if (nextIdx >= finished.length) {
      return {
        canAdvance: false,
        reason: "No more phases",
        currentPhase: phase,
      };
    }

    return {
      canAdvance: true,
      reason: "Phase complete and deployed",
      currentPhase: phase,
      nextPhase: finished[nextIdx],
    };
  }

  /**
   * Get statistics about a phase's installation state.
   */
  public getPhaseStats(sourceModId: string, phase: number): IPhaseStats {
    const state = this.mPhaseStates.get(sourceModId);
    return {
      activeCount: state?.activeByPhase.get(phase) ?? 0,
      pendingCount: state?.pendingByPhase.get(phase)?.length ?? 0,
      downloadsFinished: state?.downloadsFinished.has(phase) ?? false,
      isDeployed: state?.deployedPhases.has(phase) ?? false,
    };
  }

  // ==================== Debug Methods ====================

  /**
   * Get debug summary of all phase states.
   */
  public debugSummary(): Record<string, any> {
    const result: Record<string, any> = {};
    this.mPhaseStates.forEach((state, sourceModId) => {
      result[sourceModId] = {
        allowedPhase: state.allowedPhase,
        downloadsFinished: Array.from(state.downloadsFinished),
        deployedPhases: Array.from(state.deployedPhases),
        isDeploying: state.isDeploying,
        activeByPhase: Object.fromEntries(state.activeByPhase),
        pendingByPhase: Object.fromEntries(
          Array.from(state.pendingByPhase.entries()).map(([phase, tasks]) => [
            phase,
            tasks.length,
          ]),
        ),
      };
    });
    return result;
  }
}
