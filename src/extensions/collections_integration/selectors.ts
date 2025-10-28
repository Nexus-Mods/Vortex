import { createSelector } from 'reselect';
import {
  ICollectionInstallState,
  ICollectionInstallSession,
  ICollectionModInstallInfo,
  CollectionModStatus,
} from './types';

import { IDownload, IMod, IState } from '../../types/IState';

/**
 * Selectors for the installTracking reducer
 * Provides convenient access to collection installation state data
 */

// Base selector - gets the collections state slice
const getCollectionsState = (state: IState): ICollectionInstallState => 
  state.session?.collections || {
    activeSession: undefined,
    lastActiveSessionId: undefined,
    sessionHistory: {},
  };

/**
 * Get the active installation session
 * @returns The current active session or undefined if no session is active
 */
export const getCollectionActiveSession = (state: IState): ICollectionInstallSession | undefined => {
  const collectionsState = getCollectionsState(state);
  return collectionsState?.activeSession;
};

/**
 * Get the session ID of the last completed installation
 * @returns The last active session ID or undefined
 */
export const getCollectionLastActiveSessionId = (state: any): string | undefined => {
  const collectionsState = getCollectionsState(state);
  return collectionsState?.lastActiveSessionId;
};

/**
 * Get the history of all completed/failed installation sessions
 * @returns Map of session IDs to session data
 */
export const getCollectionSessionHistory = (state: any): { [sessionId: string]: ICollectionInstallSession } => {
  const collectionsState = getCollectionsState(state);
  return collectionsState?.sessionHistory || {};
};

/**
 * Get a specific session from history by ID
 * @param sessionId The session ID to retrieve
 * @returns The session or undefined if not found
 */
export const getCollectionSessionById = (state: any, sessionId: string): ICollectionInstallSession | undefined => {
  const activeSession = getCollectionActiveSession(state);
  if (activeSession?.sessionId === sessionId) {
    return activeSession;
  }
  const history = getCollectionSessionHistory(state);
  return history[sessionId];
};

/**
 * Get the last completed session from history
 * @returns The last completed session or undefined
 */
export const getCollectionLastCompletedSession = (state: any): ICollectionInstallSession | undefined => {
  const lastId = getCollectionLastActiveSessionId(state);
  return lastId ? getCollectionSessionById(state, lastId) : undefined;
};

/**
 * Check if there is an active installation session
 * @returns True if a session is currently active
 */
export const hasCollectionActiveSession = (state: any): boolean => {
  return getCollectionActiveSession(state) !== undefined;
};

/**
 * Check if a specific collection is currently being installed
 * @param collectionId The collection ID to check
 * @returns True if the collection is being installed
 */
export const isCollectionInstalling = (state: any, collectionId: string): boolean => {
  const session = getCollectionActiveSession(state);
  return session?.collectionId === collectionId;
};

/**
 * Get all mods in the active session
 * @returns Map of rule IDs to mod installation info, or empty object if no active session
 */
export const getCollectionActiveSessionMods = (state: any): { [ruleId: string]: ICollectionModInstallInfo } => {
  const session = getCollectionActiveSession(state);
  return session?.mods || {};
};

/**
 * Get a specific mod from the active session by rule ID
 * @param ruleId The rule ID to retrieve
 * @returns The mod installation info or undefined if not found
 */
export const getCollectionActiveSessionMod = (state: any, ruleId: string): ICollectionModInstallInfo | undefined => {
  const mods = getCollectionActiveSessionMods(state);
  return mods[ruleId];
};

/**
 * Search for a mod in the active collection by mod reference details
 * This is useful when you have deployment information and need to find the corresponding collection rule
 * @param searchParams Object containing mod identifiers to search by
 * @returns The mod installation info or undefined if not found
 */
export const getCollectionModByReference = (
  state: any,
  searchParams: {
    modId?: string;
    fileMD5?: string;
    fileId?: string;
    logicalFileName?: string;
  }
): ICollectionModInstallInfo | undefined => {
  const mods = getCollectionActiveSessionMods(state);

  // First try to find by modId if provided (most direct match)
  if (searchParams.modId) {
    const byModId = Object.values(mods).find(mod => mod.modId === searchParams.modId);
    if (byModId) return byModId;
  }

  // Fall back to searching by rule reference fields
  return Object.values(mods).find(mod => {
    const ref = mod.rule?.reference;
    if (!ref) return false;

    // Check each available identifier
    if (searchParams.fileMD5 && ref.fileMD5 === searchParams.fileMD5) return true;
    if (searchParams.fileId && ref.id === searchParams.fileId) return true;
    if (searchParams.logicalFileName && ref.logicalFileName === searchParams.logicalFileName) return true;

    return false;
  });
};

/**
 * Get all mods with a specific status from the active session
 * @param status The status to filter by
 * @returns Array of mods with the specified status
 */
export const getCollectionModsByStatus = (state: any, status: CollectionModStatus): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod => mod.status === status);
};

/**
 * Get all required mods from the active session
 * @returns Array of required mods
 */
export const getCollectionRequiredMods = (state: any): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod => mod.type === 'requires');
};

/**
 * Get all optional/recommended mods from the active session
 * @returns Array of optional mods
 */
export const getCollectionOptionalMods = (state: any): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod => mod.type === 'recommends');
};

/**
 * Get all mods grouped by phase
 * @returns Map of phase number to array of mods in that phase
 */
export const getCollectionModsByPhase = (state: any): Map<number, ICollectionModInstallInfo[]> => {
  const mods = getCollectionActiveSessionMods(state);
  const byPhase = new Map<number, ICollectionModInstallInfo[]>();

  Object.values(mods).forEach(mod => {
    const phase = mod.rule?.extra?.phase ?? 0;
    if (!byPhase.has(phase)) {
      byPhase.set(phase, []);
    }
    byPhase.get(phase)!.push(mod);
  });

  return byPhase;
};

/**
 * Get all mods for a specific phase
 * @param phase The phase number
 * @returns Array of mods in the specified phase
 */
export const getCollectionModsForPhase = (state: any, phase: number): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod => (mod.rule?.extra?.phase ?? 0) === phase);
};

/**
 * Get the total number of phases in the active session
 * @returns The highest phase number, or 0 if no active session
 */
export const getCollectionTotalPhases = (state: any): number => {
  const mods = getCollectionActiveSessionMods(state);
  const phases = Object.values(mods).map(mod => mod.rule?.extra?.phase ?? 0);
  return phases.length > 0 ? Math.max(...phases) + 1 : 0;
};

/**
 * Get installation progress statistics for the active session
 * @returns Object with various progress metrics
 */
export const getCollectionInstallProgress = createSelector(
  [getCollectionActiveSession],
  (session): {
    totalRequired: number;
    totalOptional: number;
    downloadedCount: number;
    installedCount: number;
    failedCount: number;
    skippedCount: number;
    downloadProgress: number;  // Percentage (0-100)
    installProgress: number;   // Percentage (0-100)
    isComplete: boolean;
  } | null => {
    if (!session) {
      return null;
    }

    const downloadProgress = session.totalRequired > 0
      ? Math.round((session.downloadedCount / session.totalRequired) * 100)
      : 0;

    const installProgress = session.totalRequired > 0
      ? Math.round((session.installedCount / session.totalRequired) * 100)
      : 0;

    const isComplete = session.installedCount + session.failedCount + session.skippedCount >= session.totalRequired;

    return {
      totalRequired: session.totalRequired,
      totalOptional: session.totalOptional,
      downloadedCount: session.downloadedCount,
      installedCount: session.installedCount,
      failedCount: session.failedCount,
      skippedCount: session.skippedCount,
      downloadProgress,
      installProgress,
      isComplete,
    };
  }
);

/**
 * Get the status breakdown for all mods in the active session
 * @returns Object with counts for each status
 */
export const getCollectionStatusBreakdown = createSelector(
  [getCollectionActiveSessionMods],
  (mods): { [status: string]: number } => {
    const breakdown: { [status: string]: number } = {
      pending: 0,
      downloading: 0,
      downloaded: 0,
      installing: 0,
      installed: 0,
      failed: 0,
      skipped: 0,
      optional: 0,
    };

    Object.values(mods).forEach(mod => {
      breakdown[mod.status] = (breakdown[mod.status] || 0) + 1;
    });

    return breakdown;
  }
);

/**
 * Get mods that are currently in progress (downloading or installing)
 * @returns Array of mods that are actively being processed
 */
export const getCollectionModsInProgress = (state: any): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod =>
    mod.status === 'downloading' || mod.status === 'installing'
  );
};

/**
 * Get mods that are waiting to be processed
 * @returns Array of mods with 'pending' or 'downloaded' status
 */
export const getCollectionPendingMods = (state: any): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod =>
    mod.status === 'pending' || mod.status === 'downloaded'
  );
};

/**
 * Get mods that have completed (successfully or not)
 * @returns Array of mods with 'installed', 'failed', or 'skipped' status
 */
export const getCollectionCompletedMods = (state: any): ICollectionModInstallInfo[] => {
  const mods = getCollectionActiveSessionMods(state);
  return Object.values(mods).filter(mod =>
    mod.status === 'installed' || mod.status === 'failed' || mod.status === 'skipped'
  );
};

/**
 * Check if a specific phase is complete
 * @param phase The phase number to check
 * @returns True if all required mods in the phase are completed
 */
export const isCollectionPhaseComplete = (state: any, phase: number): boolean => {
  const phaseMods = getCollectionModsForPhase(state, phase);
  const requiredPhaseMods = phaseMods.filter(mod => mod.type === 'requires');

  if (requiredPhaseMods.length === 0) {
    return true;
  }

  return requiredPhaseMods.every(mod =>
    mod.status === 'installed' || mod.status === 'failed' || mod.status === 'skipped'
  );
};

/**
 * Get the current phase being processed
 * @returns The lowest phase number with incomplete mods, or -1 if all complete
 */
export const getCollectionCurrentPhase = (state: any): number => {
  const totalPhases = getCollectionTotalPhases(state);

  for (let phase = 0; phase < totalPhases; phase++) {
    if (!isCollectionPhaseComplete(state, phase)) {
      return phase;
    }
  }

  return -1; // All phases complete
};

/**
 * Get detailed phase progress information
 * @returns Array of phase progress objects with stats for each phase
 */
export const getCollectionPhaseProgress = createSelector(
  [getCollectionActiveSessionMods],
  (mods): Array<{
    phase: number;
    total: number;
    required: number;
    optional: number;
    installed: number;
    failed: number;
    skipped: number;
    pending: number;
    progress: number;  // Percentage (0-100)
    isComplete: boolean;
  }> => {
    const byPhase = new Map<number, ICollectionModInstallInfo[]>();

    Object.values(mods).forEach(mod => {
      const phase = mod.rule?.extra?.phase ?? 0;
      if (!byPhase.has(phase)) {
        byPhase.set(phase, []);
      }
      byPhase.get(phase)!.push(mod);
    });

    const phases = Array.from(byPhase.keys()).sort((a, b) => a - b);

    return phases.map(phase => {
      const phaseMods = byPhase.get(phase)!;
      const required = phaseMods.filter(m => m.type === 'requires');
      const optional = phaseMods.filter(m => m.type === 'recommends');
      const installed = required.filter(m => m.status === 'installed').length;
      const failed = required.filter(m => m.status === 'failed').length;
      const skipped = required.filter(m => m.status === 'skipped').length;
      const pending = required.filter(m =>
        m.status === 'pending' || m.status === 'downloading' || m.status === 'downloaded' || m.status === 'installing'
      ).length;
      const completed = installed + failed + skipped;
      const progress = required.length > 0 ? Math.round((completed / required.length) * 100) : 100;
      const isComplete = completed >= required.length;

      return {
        phase,
        total: phaseMods.length,
        required: required.length,
        optional: optional.length,
        installed,
        failed,
        skipped,
        pending,
        progress,
        isComplete,
      };
    });
  }
);
