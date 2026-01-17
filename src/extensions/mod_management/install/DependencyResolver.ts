/**
 * DependencyResolver - Handles dependency resolution and categorization.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Types for dependency installation state
 * - Utility functions for splitting/categorizing dependencies
 * - Helper functions for dependency validation
 */

import { log } from "../../../util/log";
import type {
  IDependency,
  IDependencyError,
  Dependency as DependencyResult,
} from "../types/IDependency";

// Re-export for consumers
export type { IDependencyError };
export type { DependencyResult };

/**
 * Categorized dependencies after splitting by status.
 */
export interface IDependencySplit {
  /** Dependencies that need to be installed */
  success: IDependency[];
  /** Dependencies that are already installed and enabled */
  existing: IDependency[];
  /** Dependencies that failed to resolve */
  error: IDependencyError[];
}

/**
 * Progress callback for dependency operations.
 * @param percent - Progress as a decimal (0-1)
 */
export type DependencyProgressCallback = (percent: number) => void;

/**
 * Options for dependency resolution.
 */
export interface IDependencyResolveOptions {
  /** Whether to include recommended mods */
  includeRecommended?: boolean;
  /** Progress callback */
  onProgress?: DependencyProgressCallback;
  /** Whether to operate silently (no UI) */
  silent?: boolean;
}

/**
 * Check if a dependency result is an error.
 */
export function isDependencyError(
  dep: DependencyResult,
): dep is IDependencyError {
  return (dep as IDependencyError).error !== undefined;
}

/**
 * Check if a dependency result is a successful dependency.
 */
export function isDependency(dep: DependencyResult): dep is IDependency {
  return !isDependencyError(dep);
}

/**
 * Split dependencies into categories based on their status.
 *
 * @param dependencies - Array of dependency results to categorize
 * @param isModEnabled - Function to check if a mod is enabled
 * @param testModMatch - Function to test if a mod matches a reference
 * @returns Categorized dependencies
 */
export function splitDependencies(
  dependencies: DependencyResult[],
  isModEnabled: (modId: string) => boolean,
  testModMatch: (mod: any, reference: any) => boolean | string,
): IDependencySplit {
  return dependencies.reduce(
    (prev: IDependencySplit, dep: DependencyResult) => {
      if (isDependencyError(dep)) {
        prev.error.push(dep);
      } else {
        const { mod, reference } = dep;
        // Build a combined reference for matching
        const modReference = {
          ...dep,
          ...reference,
        };

        if (
          mod === undefined ||
          !isModEnabled(mod.id) ||
          testModMatch(mod, modReference) !== true
        ) {
          prev.success.push(dep);
        } else {
          prev.existing.push(dep);
        }
      }
      return prev;
    },
    { success: [], existing: [], error: [] },
  );
}

/**
 * Filter dependencies that are already being processed.
 *
 * @param dependencies - Dependencies to filter
 * @param isProcessing - Function to check if a dependency is being processed
 * @returns Filtered dependencies that are not already being processed
 */
export function filterProcessingDependencies(
  dependencies: IDependency[],
  isProcessing: (dep: IDependency) => boolean,
): IDependency[] {
  return dependencies.filter((dep) => !isProcessing(dep));
}

/**
 * Group dependencies by their phase number.
 *
 * @param dependencies - Dependencies to group
 * @returns Map of phase number to dependencies in that phase
 */
export function groupDependenciesByPhase(
  dependencies: IDependency[],
): Map<number, IDependency[]> {
  const byPhase = new Map<number, IDependency[]>();

  for (const dep of dependencies) {
    const phase = dep.phase ?? 0;
    if (!byPhase.has(phase)) {
      byPhase.set(phase, []);
    }
    byPhase.get(phase)!.push(dep);
  }

  return byPhase;
}

/**
 * Get the phases that have dependencies, sorted in order.
 *
 * @param dependencies - Dependencies to analyze
 * @returns Sorted array of unique phase numbers
 */
export function getPhases(dependencies: IDependency[]): number[] {
  const phases = new Set<number>();
  for (const dep of dependencies) {
    phases.add(dep.phase ?? 0);
  }
  return Array.from(phases).sort((a, b) => a - b);
}

/**
 * Count dependencies by their resolution status.
 *
 * @param split - Categorized dependencies
 * @returns Object with counts for each category
 */
export function countDependencies(split: IDependencySplit): {
  total: number;
  success: number;
  existing: number;
  error: number;
} {
  return {
    total: split.success.length + split.existing.length + split.error.length,
    success: split.success.length,
    existing: split.existing.length,
    error: split.error.length,
  };
}

/**
 * Check if all dependencies in a phase are resolved (either installed or errored).
 *
 * @param phaseDeps - Dependencies in a phase
 * @param isInstalled - Function to check if a dependency's mod is installed
 * @returns True if all dependencies are resolved
 */
export function isPhaseComplete(
  phaseDeps: IDependency[],
  isInstalled: (dep: IDependency) => boolean,
): boolean {
  return phaseDeps.every((dep) => isInstalled(dep));
}

/**
 * Get dependencies that are ready to install (have download available).
 *
 * @param dependencies - Dependencies to check
 * @param hasDownload - Function to check if dependency has a download
 * @returns Dependencies that are ready to install
 */
export function getReadyToInstall(
  dependencies: IDependency[],
  hasDownload: (dep: IDependency) => boolean,
): IDependency[] {
  return dependencies.filter(hasDownload);
}

/**
 * Get dependencies that need to be downloaded first.
 *
 * @param dependencies - Dependencies to check
 * @param hasDownload - Function to check if dependency has a download
 * @returns Dependencies that need downloading
 */
export function getNeedingDownload(
  dependencies: IDependency[],
  hasDownload: (dep: IDependency) => boolean,
): IDependency[] {
  return dependencies.filter((dep) => !hasDownload(dep));
}

/**
 * Create a progress tracker for batch operations.
 *
 * @param total - Total number of items
 * @param onProgress - Progress callback
 * @returns Function to call when an item completes
 */
export function createProgressTracker(
  total: number,
  onProgress?: DependencyProgressCallback,
): () => void {
  let completed = 0;
  return () => {
    completed++;
    if (onProgress && total > 0) {
      onProgress(completed / total);
    }
  };
}

/**
 * Summarize dependency errors for display.
 *
 * @param errors - Array of dependency errors
 * @returns Formatted error summary string
 */
export function summarizeErrors(errors: IDependencyError[]): string {
  if (errors.length === 0) {
    return "";
  }

  return errors
    .map((err) => {
      const refName = err.reference?.logicalFileName || "Unknown";
      return `- ${refName}: ${err.error}`;
    })
    .join("\n");
}

/**
 * Log dependency resolution results.
 *
 * @param split - Categorized dependencies
 * @param context - Context string for the log
 */
export function logDependencyResults(
  split: IDependencySplit,
  context: string,
): void {
  const counts = countDependencies(split);
  log("debug", `${context}: dependency resolution complete`, {
    total: counts.total,
    toInstall: counts.success,
    existing: counts.existing,
    errors: counts.error,
  });

  if (counts.error > 0) {
    log("warn", `${context}: dependency errors`, {
      errors: split.error.map((e) => ({
        ref: e.reference?.logicalFileName,
        error: e.error,
      })),
    });
  }
}
