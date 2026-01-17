import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PhaseManager } from '../../../src/extensions/mod_management/install/PhaseManager';

// Mock the log utility
jest.mock('../../../src/util/log', () => ({
  log: jest.fn(),
}));

describe('PhaseManager', () => {
  let manager: PhaseManager;

  beforeEach(() => {
    manager = new PhaseManager();
  });

  describe('State Initialization', () => {
    it('should create new state when ensureState is called', () => {
      expect(manager.hasState('collection1')).toBe(false);
      manager.ensureState('collection1');
      expect(manager.hasState('collection1')).toBe(true);
    });

    it('should not overwrite existing state when ensureState is called again', () => {
      manager.ensureState('collection1');
      manager.setAllowedPhase('collection1', 2);

      manager.ensureState('collection1'); // Call again

      expect(manager.getAllowedPhase('collection1')).toBe(2);
    });

    it('should return undefined for non-existent state', () => {
      expect(manager.getState('nonexistent')).toBeUndefined();
    });

    it('should delete state correctly', () => {
      manager.ensureState('collection1');
      expect(manager.hasState('collection1')).toBe(true);

      manager.deleteState('collection1');
      expect(manager.hasState('collection1')).toBe(false);
    });

    it('should initialize state with correct default values', () => {
      manager.ensureState('collection1');
      const state = manager.getState('collection1');

      expect(state).toBeDefined();
      expect(state.allowedPhase).toBeUndefined();
      expect(state.downloadsFinished).toBeInstanceOf(Set);
      expect(state.downloadsFinished.size).toBe(0);
      expect(state.pendingByPhase).toBeInstanceOf(Map);
      expect(state.activeByPhase).toBeInstanceOf(Map);
      expect(state.deployedPhases).toBeInstanceOf(Set);
      expect(state.deploymentPromises).toBeInstanceOf(Map);
    });
  });

  describe('Phase Tracking', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should set and get allowed phase', () => {
      expect(manager.getAllowedPhase('collection1')).toBeUndefined();

      manager.setAllowedPhase('collection1', 3);

      expect(manager.getAllowedPhase('collection1')).toBe(3);
    });

    it('should return undefined for allowed phase when state does not exist', () => {
      expect(manager.getAllowedPhase('nonexistent')).toBeUndefined();
    });

    it('should mark downloads as finished', () => {
      expect(manager.hasDownloadsFinished('collection1', 0)).toBe(false);

      manager.markDownloadsFinished('collection1', 0);

      expect(manager.hasDownloadsFinished('collection1', 0)).toBe(true);
    });

    it('should initialize allowed phase on first markDownloadsFinished call', () => {
      manager.markDownloadsFinished('collection1', 2);

      expect(manager.getAllowedPhase('collection1')).toBe(2);
    });

    it('should mark all previous phases as finished when starting from higher phase', () => {
      manager.markDownloadsFinished('collection1', 3);

      expect(manager.hasDownloadsFinished('collection1', 0)).toBe(true);
      expect(manager.hasDownloadsFinished('collection1', 1)).toBe(true);
      expect(manager.hasDownloadsFinished('collection1', 2)).toBe(true);
      expect(manager.hasDownloadsFinished('collection1', 3)).toBe(true);
      expect(manager.hasDownloadsFinished('collection1', 4)).toBe(false);
    });

    it('should not change allowed phase if already set', () => {
      manager.setAllowedPhase('collection1', 1);

      manager.markDownloadsFinished('collection1', 5);

      expect(manager.getAllowedPhase('collection1')).toBe(1);
    });

    it('should return finished phases in sorted order', () => {
      manager.markDownloadsFinished('collection1', 2);
      manager.markDownloadsFinished('collection1', 5);
      manager.markDownloadsFinished('collection1', 3);

      const finished = manager.getFinishedPhases('collection1');

      expect(finished).toEqual([0, 1, 2, 3, 5]);
    });

    it('should return empty array for non-existent state', () => {
      expect(manager.getFinishedPhases('nonexistent')).toEqual([]);
    });
  });

  describe('Deployment Tracking', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should mark and check phase deployed', () => {
      expect(manager.isPhaseDeployed('collection1', 0)).toBe(false);

      manager.markPhaseDeployed('collection1', 0);

      expect(manager.isPhaseDeployed('collection1', 0)).toBe(true);
    });

    it('should return false for non-existent state', () => {
      expect(manager.isPhaseDeployed('nonexistent', 0)).toBe(false);
    });

    it('should set and check deploying flag', () => {
      expect(manager.isDeploying('collection1')).toBe(false);

      manager.setDeploying('collection1', true);
      expect(manager.isDeploying('collection1')).toBe(true);

      manager.setDeploying('collection1', false);
      expect(manager.isDeploying('collection1')).toBe(false);
    });

    it('should return false for deploying when state does not exist', () => {
      expect(manager.isDeploying('nonexistent')).toBe(false);
    });
  });

  describe('Deployment Promises', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should set and get deployment promise', () => {
      const details = {
        deploymentPromise: Promise.resolve(),
        deployOnSettle: true,
      };

      manager.setDeploymentPromise('collection1', 0, details);

      expect(manager.getDeploymentPromise('collection1', 0)).toBe(details);
    });

    it('should return undefined for non-existent deployment promise', () => {
      expect(manager.getDeploymentPromise('collection1', 99)).toBeUndefined();
    });

    it('should delete deployment promise', () => {
      const details = {
        deploymentPromise: Promise.resolve(),
        deployOnSettle: false,
      };

      manager.setDeploymentPromise('collection1', 0, details);
      manager.deleteDeploymentPromise('collection1', 0);

      expect(manager.getDeploymentPromise('collection1', 0)).toBeUndefined();
    });
  });

  describe('Active/Pending Tracking', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should increment and get active count', () => {
      expect(manager.getActiveCount('collection1', 0)).toBe(0);

      manager.incrementActive('collection1', 0);
      expect(manager.getActiveCount('collection1', 0)).toBe(1);

      manager.incrementActive('collection1', 0);
      expect(manager.getActiveCount('collection1', 0)).toBe(2);
    });

    it('should decrement active count', () => {
      manager.incrementActive('collection1', 0);
      manager.incrementActive('collection1', 0);

      manager.decrementActive('collection1', 0);
      expect(manager.getActiveCount('collection1', 0)).toBe(1);
    });

    it('should not decrement below zero', () => {
      manager.decrementActive('collection1', 0);
      expect(manager.getActiveCount('collection1', 0)).toBe(0);
    });

    it('should track active counts separately per phase', () => {
      manager.incrementActive('collection1', 0);
      manager.incrementActive('collection1', 0);
      manager.incrementActive('collection1', 1);

      expect(manager.getActiveCount('collection1', 0)).toBe(2);
      expect(manager.getActiveCount('collection1', 1)).toBe(1);
      expect(manager.getActiveCount('collection1', 2)).toBe(0);
    });

    it('should return 0 for non-existent state', () => {
      expect(manager.getActiveCount('nonexistent', 0)).toBe(0);
    });

    it('should queue and drain pending tasks', () => {
      const task1 = jest.fn();
      const task2 = jest.fn();

      manager.queuePending('collection1', 0, task1);
      manager.queuePending('collection1', 0, task2);

      expect(manager.getPendingCount('collection1', 0)).toBe(2);

      const tasks = manager.drainPending('collection1', 0);

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toBe(task1);
      expect(tasks[1]).toBe(task2);
      expect(manager.getPendingCount('collection1', 0)).toBe(0);
    });

    it('should return empty array when draining non-existent phase', () => {
      const tasks = manager.drainPending('collection1', 99);
      expect(tasks).toEqual([]);
    });

    it('should return empty array when draining non-existent state', () => {
      const tasks = manager.drainPending('nonexistent', 0);
      expect(tasks).toEqual([]);
    });

    it('should return 0 for pending count on non-existent state', () => {
      expect(manager.getPendingCount('nonexistent', 0)).toBe(0);
    });
  });

  describe('Re-queue Tracking', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should track re-queue attempts', () => {
      expect(manager.hasReQueueAttempted('collection1', 0)).toBe(false);

      manager.markReQueueAttempted('collection1', 0);

      expect(manager.hasReQueueAttempted('collection1', 0)).toBe(true);
    });

    it('should count re-queue attempts', () => {
      expect(manager.getReQueueAttemptCount('collection1', 0)).toBe(0);

      manager.markReQueueAttempted('collection1', 0);
      expect(manager.getReQueueAttemptCount('collection1', 0)).toBe(1);

      manager.markReQueueAttempted('collection1', 0);
      expect(manager.getReQueueAttemptCount('collection1', 0)).toBe(2);
    });

    it('should track attempts separately per phase', () => {
      manager.markReQueueAttempted('collection1', 0);
      manager.markReQueueAttempted('collection1', 1);
      manager.markReQueueAttempted('collection1', 1);

      expect(manager.getReQueueAttemptCount('collection1', 0)).toBe(1);
      expect(manager.getReQueueAttemptCount('collection1', 1)).toBe(2);
    });

    it('should return false for non-existent state', () => {
      expect(manager.hasReQueueAttempted('nonexistent', 0)).toBe(false);
    });

    it('should return 0 for non-existent state count', () => {
      expect(manager.getReQueueAttemptCount('nonexistent', 0)).toBe(0);
    });

    it('should clear future re-queue attempts', () => {
      manager.setAllowedPhase('collection1', 2);
      manager.markReQueueAttempted('collection1', 1);
      manager.markReQueueAttempted('collection1', 2);
      manager.markReQueueAttempted('collection1', 3);
      manager.markReQueueAttempted('collection1', 4);

      manager.clearFutureReQueueAttempts('collection1');

      expect(manager.hasReQueueAttempted('collection1', 1)).toBe(true);
      expect(manager.hasReQueueAttempted('collection1', 2)).toBe(true);
      expect(manager.hasReQueueAttempted('collection1', 3)).toBe(false);
      expect(manager.hasReQueueAttempted('collection1', 4)).toBe(false);
    });
  });

  describe('Download Lookup Cache', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should cache and retrieve download by tag', () => {
      expect(manager.getCachedDownloadByTag('collection1', 'tag1')).toBeUndefined();

      manager.cacheDownloadByTag('collection1', 'tag1', 'download1');

      expect(manager.getCachedDownloadByTag('collection1', 'tag1')).toBe('download1');
    });

    it('should cache and retrieve download by MD5', () => {
      expect(manager.getCachedDownloadByMd5('collection1', 'abc123')).toBeUndefined();

      manager.cacheDownloadByMd5('collection1', 'abc123', 'download2');

      expect(manager.getCachedDownloadByMd5('collection1', 'abc123')).toBe('download2');
    });

    it('should return undefined for non-existent state', () => {
      expect(manager.getCachedDownloadByTag('nonexistent', 'tag')).toBeUndefined();
      expect(manager.getCachedDownloadByMd5('nonexistent', 'md5')).toBeUndefined();
    });
  });

  describe('Phase Advancement Logic', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should report cannot advance when no state', () => {
      const check = manager.canPhaseAdvance('nonexistent');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('No phase state');
      expect(check.currentPhase).toBe(-1);
    });

    it('should report cannot advance when awaiting first finished phase', () => {
      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('Awaiting first finished phase');
      expect(check.currentPhase).toBe(-1);
    });

    it('should report cannot advance when downloads not finished', () => {
      manager.setAllowedPhase('collection1', 0);
      // Don't mark downloads as finished

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('Downloads not finished');
      expect(check.currentPhase).toBe(0);
    });

    it('should report cannot advance when active installations exist', () => {
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      manager.incrementActive('collection1', 0);

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('1 active installations');
      expect(check.currentPhase).toBe(0);
    });

    it('should report cannot advance when pending installations exist', () => {
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      manager.queuePending('collection1', 0, jest.fn());

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('1 pending installations');
      expect(check.currentPhase).toBe(0);
    });

    it('should report cannot advance when phase not deployed', () => {
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      // Don't mark as deployed

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('Phase not deployed');
      expect(check.currentPhase).toBe(0);
    });

    it('should report cannot advance when no more phases', () => {
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      manager.markPhaseDeployed('collection1', 0);

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(false);
      expect(check.reason).toBe('No more phases');
      expect(check.currentPhase).toBe(0);
    });

    it('should report can advance when all conditions met', () => {
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      manager.markDownloadsFinished('collection1', 1); // Next phase ready
      manager.markPhaseDeployed('collection1', 0);

      const check = manager.canPhaseAdvance('collection1');

      expect(check.canAdvance).toBe(true);
      expect(check.reason).toBe('Phase complete and deployed');
      expect(check.currentPhase).toBe(0);
      expect(check.nextPhase).toBe(1);
    });
  });

  describe('Phase Stats', () => {
    beforeEach(() => {
      manager.ensureState('collection1');
    });

    it('should return correct stats for a phase', () => {
      manager.markDownloadsFinished('collection1', 0);
      manager.incrementActive('collection1', 0);
      manager.incrementActive('collection1', 0);
      manager.queuePending('collection1', 0, jest.fn());
      manager.markPhaseDeployed('collection1', 0);

      const stats = manager.getPhaseStats('collection1', 0);

      expect(stats.activeCount).toBe(2);
      expect(stats.pendingCount).toBe(1);
      expect(stats.downloadsFinished).toBe(true);
      expect(stats.isDeployed).toBe(true);
    });

    it('should return default stats for non-existent state', () => {
      const stats = manager.getPhaseStats('nonexistent', 0);

      expect(stats.activeCount).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.downloadsFinished).toBe(false);
      expect(stats.isDeployed).toBe(false);
    });
  });

  describe('Debug Summary', () => {
    it('should provide debug summary of all states', () => {
      manager.ensureState('collection1');
      manager.setAllowedPhase('collection1', 1);
      manager.markDownloadsFinished('collection1', 0);
      manager.markDownloadsFinished('collection1', 1);
      manager.markPhaseDeployed('collection1', 0);
      manager.setDeploying('collection1', true);
      manager.incrementActive('collection1', 1);
      manager.queuePending('collection1', 2, jest.fn());

      manager.ensureState('collection2');

      const summary = manager.debugSummary();

      expect(summary['collection1']).toBeDefined();
      expect(summary['collection1'].allowedPhase).toBe(1);
      expect(summary['collection1'].downloadsFinished).toContain(0);
      expect(summary['collection1'].downloadsFinished).toContain(1);
      expect(summary['collection1'].deployedPhases).toContain(0);
      expect(summary['collection1'].isDeploying).toBe(true);
      expect(summary['collection1'].activeByPhase['1']).toBe(1);
      expect(summary['collection1'].pendingByPhase['2']).toBe(1);

      expect(summary['collection2']).toBeDefined();
      expect(summary['collection2'].allowedPhase).toBeUndefined();
    });

    it('should return empty object when no states exist', () => {
      const summary = manager.debugSummary();
      expect(summary).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple collections independently', () => {
      manager.ensureState('collection1');
      manager.ensureState('collection2');

      manager.setAllowedPhase('collection1', 0);
      manager.setAllowedPhase('collection2', 5);
      manager.markDownloadsFinished('collection1', 0);
      manager.markDownloadsFinished('collection2', 5);
      manager.incrementActive('collection1', 0);
      manager.incrementActive('collection2', 5);
      manager.incrementActive('collection2', 5);

      expect(manager.getAllowedPhase('collection1')).toBe(0);
      expect(manager.getAllowedPhase('collection2')).toBe(5);
      expect(manager.getActiveCount('collection1', 0)).toBe(1);
      expect(manager.getActiveCount('collection2', 5)).toBe(2);
    });

    it('should handle high phase numbers', () => {
      manager.ensureState('collection1');
      manager.setAllowedPhase('collection1', 999);
      manager.markDownloadsFinished('collection1', 999);

      expect(manager.getAllowedPhase('collection1')).toBe(999);
      expect(manager.hasDownloadsFinished('collection1', 999)).toBe(true);
    });

    it('should handle phase 0 correctly', () => {
      manager.ensureState('collection1');
      manager.setAllowedPhase('collection1', 0);
      manager.markDownloadsFinished('collection1', 0);
      manager.incrementActive('collection1', 0);
      manager.markPhaseDeployed('collection1', 0);

      expect(manager.getAllowedPhase('collection1')).toBe(0);
      expect(manager.hasDownloadsFinished('collection1', 0)).toBe(true);
      expect(manager.getActiveCount('collection1', 0)).toBe(1);
      expect(manager.isPhaseDeployed('collection1', 0)).toBe(true);
    });
  });
});
