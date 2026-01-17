/**
 * InstallationTracker - Tracks active and pending mod installations.
 * Extracted from InstallManager.ts for better modularity.
 *
 * This class manages:
 * - Active installations (currently being processed)
 * - Pending installations (queued for processing)
 * - Installation key generation for dependency tracking
 * - Cleanup of stuck or stale installations
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { dismissNotification } from "../../../actions/notifications";
import { log } from "../../../util/log";
import { getErrorMessageOrDefault } from "../../../shared/errors";
import type { IDependency } from "../types/IDependency";
import type { IActiveInstallation } from "./types/IInstallationEntry";

/**
 * Debug information about an active installation.
 */
export interface IActiveInstallDebugInfo {
  installId: string;
  modId: string;
  gameId: string;
  baseName: string;
  durationMs: number;
  durationMinutes: number;
}

/**
 * Tracks active and pending mod installations.
 *
 * Active installations are those currently being processed.
 * Pending installations are queued and waiting for their turn
 * (e.g., waiting for their phase to become active in collections).
 */
export class InstallationTracker {
  // Tracks currently active installations
  private mActiveInstalls: Map<string, IActiveInstallation> = new Map();

  // Queues installations for processing - primarily used for dependency phase tracking
  private mPendingInstalls: Map<string, IDependency> = new Map();

  /**
   * Generate a unique key for tracking dependency installations.
   * Format: "sourceModId:downloadId"
   */
  public generateInstallKey(sourceModId: string, downloadId: string): string {
    return `${sourceModId}:${downloadId}`;
  }

  // ==================== Active Installation Methods ====================

  /**
   * Register an active installation.
   */
  public setActive(installId: string, info: IActiveInstallation): void {
    this.mActiveInstalls.set(installId, info);
  }

  /**
   * Remove an active installation.
   */
  public deleteActive(installId: string): void {
    this.mActiveInstalls.delete(installId);
  }

  /**
   * Get an active installation by ID.
   */
  public getActive(installId: string): IActiveInstallation | undefined {
    return this.mActiveInstalls.get(installId);
  }

  /**
   * Check if an installation is currently active.
   */
  public hasActive(installId: string): boolean {
    return this.mActiveInstalls.has(installId);
  }

  /**
   * Get all active installations.
   */
  public getActiveInstallations(): IActiveInstallation[] {
    return Array.from(this.mActiveInstalls.values());
  }

  /**
   * Get count of active installations.
   */
  public getActiveCount(): number {
    return this.mActiveInstalls.size;
  }

  /**
   * Check if any installation is active for a specific archive.
   */
  public hasActiveForArchive(archiveId: string): boolean {
    for (const [, activeInstall] of this.mActiveInstalls.entries()) {
      if (activeInstall.archiveId === archiveId) {
        return true;
      }
    }
    return false;
  }

  // ==================== Pending Installation Methods ====================

  /**
   * Queue a pending installation.
   */
  public setPending(installKey: string, dep: IDependency): void {
    this.mPendingInstalls.set(installKey, dep);
  }

  /**
   * Remove a pending installation.
   */
  public deletePending(installKey: string): void {
    this.mPendingInstalls.delete(installKey);
  }

  /**
   * Get a pending installation by key.
   */
  public getPending(installKey: string): IDependency | undefined {
    return this.mPendingInstalls.get(installKey);
  }

  /**
   * Check if an installation is pending.
   */
  public hasPending(installKey: string): boolean {
    return this.mPendingInstalls.has(installKey);
  }

  /**
   * Get count of pending installations.
   */
  public getPendingCount(): number {
    return this.mPendingInstalls.size;
  }

  // ==================== Combined Queries ====================

  /**
   * Check if there are any active or pending installations.
   * If archiveId is provided, checks specifically for that archive.
   */
  public hasActiveOrPending(sourceModId: string, archiveId?: string): boolean {
    if (!archiveId) {
      return this.mPendingInstalls.size > 0 || this.mActiveInstalls.size > 0;
    }

    const installKey = this.generateInstallKey(sourceModId, archiveId);
    const hasPending = this.mPendingInstalls.has(installKey);
    const hasActive = this.hasActiveForArchive(archiveId);

    return hasPending || hasActive;
  }

  /**
   * Check if there are any active or pending installations in total.
   */
  public hasAnyActiveOrPending(): boolean {
    return this.mPendingInstalls.size > 0 || this.mActiveInstalls.size > 0;
  }

  // ==================== Cleanup Methods ====================

  /**
   * Clean up all pending and active installations for a specific source mod.
   * Returns the count of items cleaned up.
   */
  public cleanupForSourceMod(sourceModId: string): {
    pending: number;
    active: number;
  } {
    // Clean up pending installs
    const pendingKeysToRemove = Array.from(this.mPendingInstalls.keys()).filter(
      (key) => key.includes(sourceModId),
    );
    pendingKeysToRemove.forEach((key) => this.mPendingInstalls.delete(key));

    // Clean up active installs
    const activeKeysToRemove = Array.from(this.mActiveInstalls.keys()).filter(
      (key) => key.includes(sourceModId),
    );
    activeKeysToRemove.forEach((key) => this.mActiveInstalls.delete(key));

    return {
      pending: pendingKeysToRemove.length,
      active: activeKeysToRemove.length,
    };
  }

  /**
   * Force cleanup of stuck installations (for debugging).
   * @param api - Extension API for dismissing notifications
   * @param maxAgeMinutes - Installations older than this will be force-cleaned
   * @returns Number of stuck installations cleaned up
   */
  public forceCleanupStuckInstalls(
    api: IExtensionApi,
    maxAgeMinutes: number = 10,
  ): number {
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const stuckInstalls: IActiveInstallation[] = [];

    this.mActiveInstalls.forEach((install) => {
      const age = now - install.startTime;
      if (age > maxAgeMs) {
        stuckInstalls.push(install);
      }
    });

    // Force cleanup of stuck installations
    stuckInstalls.forEach((install) => {
      const { installId, modId, callback } = install;
      this.mActiveInstalls.delete(installId);

      try {
        const timeoutError = new Error(
          `Installation timed out after ${maxAgeMinutes} minutes`,
        );
        timeoutError.name = "InstallationTimeoutError";
        callback(timeoutError, modId);
        log(
          "info",
          "InstallationTracker: Called callback for stuck installation",
          {
            installId,
            modId,
          },
        );
      } catch (callbackError) {
        log(
          "error",
          "InstallationTracker: Error calling callback for stuck installation",
          {
            installId,
            modId,
            error: getErrorMessageOrDefault(callbackError),
          },
        );
      }

      // Try to dismiss any lingering notifications
      try {
        api.store.dispatch(dismissNotification(`install_${installId}`));
        api.store.dispatch(
          dismissNotification(`ready-to-install-${installId}`),
        );
      } catch (err) {
        log("warn", "Error dismissing notification during force cleanup", {
          installId,
          error: getErrorMessageOrDefault(err),
        });
      }
    });

    return stuckInstalls.length;
  }

  // ==================== Debug Methods ====================

  /**
   * Get debug information about all active installations.
   */
  public debugActiveInstalls(): IActiveInstallDebugInfo[] {
    const now = Date.now();
    return Array.from(this.mActiveInstalls.entries()).map(([key, install]) => ({
      installId: key,
      modId: install.modId,
      gameId: install.gameId,
      baseName: install.baseName,
      durationMs: now - install.startTime,
      durationMinutes:
        Math.round(((now - install.startTime) / 60000) * 100) / 100,
    }));
  }

  /**
   * Get debug summary of tracker state.
   */
  public debugSummary(): {
    activeCount: number;
    pendingCount: number;
    activeKeys: string[];
    pendingKeys: string[];
  } {
    return {
      activeCount: this.mActiveInstalls.size,
      pendingCount: this.mPendingInstalls.size,
      activeKeys: Array.from(this.mActiveInstalls.keys()),
      pendingKeys: Array.from(this.mPendingInstalls.keys()),
    };
  }
}
