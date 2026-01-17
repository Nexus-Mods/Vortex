import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InstallationTracker } from '../../../src/extensions/mod_management/install/InstallationTracker';
import type { IActiveInstallation } from '../../../src/extensions/mod_management/install/types/IInstallationEntry';

// Mock the log utility
jest.mock('../../../src/util/log', () => ({
  log: jest.fn(),
}));

// Mock shared errors
jest.mock('../../../src/shared/errors', () => ({
  getErrorMessageOrDefault: jest.fn((err: any) => err?.message || 'Unknown error'),
}));

describe('InstallationTracker', () => {
  let tracker: InstallationTracker;

  beforeEach(() => {
    tracker = new InstallationTracker();
  });

  describe('generateInstallKey', () => {
    it('should generate a key in the format sourceModId:downloadId', () => {
      expect(tracker.generateInstallKey('mod1', 'dl1')).toBe('mod1:dl1');
    });

    it('should handle empty strings', () => {
      expect(tracker.generateInstallKey('', '')).toBe(':');
    });
  });

  describe('Active Installation Methods', () => {
    const mockInstallation: IActiveInstallation = {
      installId: 'install-1',
      archiveId: 'archive-1',
      archivePath: '/path/to/archive.zip',
      modId: 'mod-1',
      gameId: 'game-1',
      callback: jest.fn(),
      startTime: Date.now(),
      baseName: 'test-mod',
    };

    it('should set and get active installations', () => {
      tracker.setActive('install-1', mockInstallation);
      expect(tracker.getActive('install-1')).toEqual(mockInstallation);
    });

    it('should return undefined for non-existent installation', () => {
      expect(tracker.getActive('nonexistent')).toBeUndefined();
    });

    it('should check if installation is active', () => {
      tracker.setActive('install-1', mockInstallation);
      expect(tracker.hasActive('install-1')).toBe(true);
      expect(tracker.hasActive('nonexistent')).toBe(false);
    });

    it('should delete active installation', () => {
      tracker.setActive('install-1', mockInstallation);
      tracker.deleteActive('install-1');
      expect(tracker.hasActive('install-1')).toBe(false);
    });

    it('should get all active installations', () => {
      const install1 = { ...mockInstallation, installId: 'i1' };
      const install2 = { ...mockInstallation, installId: 'i2' };
      tracker.setActive('i1', install1);
      tracker.setActive('i2', install2);

      const all = tracker.getActiveInstallations();
      expect(all).toHaveLength(2);
    });

    it('should get active count', () => {
      expect(tracker.getActiveCount()).toBe(0);
      tracker.setActive('install-1', mockInstallation);
      expect(tracker.getActiveCount()).toBe(1);
    });

    it('should check if active installation exists for archive', () => {
      tracker.setActive('install-1', mockInstallation);
      expect(tracker.hasActiveForArchive('archive-1')).toBe(true);
      expect(tracker.hasActiveForArchive('other-archive')).toBe(false);
    });
  });

  describe('Pending Installation Methods', () => {
    const mockDependency = {
      download: 'dl-1',
      reference: { id: 'ref-1' },
      lookupResults: [],
    } as any;

    it('should set and get pending installations', () => {
      tracker.setPending('key1', mockDependency);
      expect(tracker.getPending('key1')).toEqual(mockDependency);
    });

    it('should return undefined for non-existent pending', () => {
      expect(tracker.getPending('nonexistent')).toBeUndefined();
    });

    it('should check if installation is pending', () => {
      tracker.setPending('key1', mockDependency);
      expect(tracker.hasPending('key1')).toBe(true);
      expect(tracker.hasPending('nonexistent')).toBe(false);
    });

    it('should delete pending installation', () => {
      tracker.setPending('key1', mockDependency);
      tracker.deletePending('key1');
      expect(tracker.hasPending('key1')).toBe(false);
    });

    it('should get pending count', () => {
      expect(tracker.getPendingCount()).toBe(0);
      tracker.setPending('key1', mockDependency);
      expect(tracker.getPendingCount()).toBe(1);
    });
  });

  describe('Combined Queries', () => {
    const mockInstallation: IActiveInstallation = {
      installId: 'mod1:dl1',
      archiveId: 'dl1',
      archivePath: '/path/to/archive.zip',
      modId: 'mod-1',
      gameId: 'game-1',
      callback: jest.fn(),
      startTime: Date.now(),
      baseName: 'test-mod',
    };

    const mockDependency = {
      download: 'dl-1',
      reference: { id: 'ref-1' },
      lookupResults: [],
    } as any;

    it('should detect any active or pending without archiveId', () => {
      expect(tracker.hasActiveOrPending('mod1')).toBe(false);

      tracker.setActive('mod1:dl1', mockInstallation);
      expect(tracker.hasActiveOrPending('mod1')).toBe(true);
    });

    it('should detect specific archive in pending', () => {
      tracker.setPending('mod1:dl1', mockDependency);
      expect(tracker.hasActiveOrPending('mod1', 'dl1')).toBe(true);
      expect(tracker.hasActiveOrPending('mod1', 'dl2')).toBe(false);
    });

    it('should detect specific archive in active', () => {
      tracker.setActive('mod1:dl1', mockInstallation);
      expect(tracker.hasActiveOrPending('mod1', 'dl1')).toBe(true);
      expect(tracker.hasActiveOrPending('mod1', 'dl2')).toBe(false);
    });

    it('should check hasAnyActiveOrPending', () => {
      expect(tracker.hasAnyActiveOrPending()).toBe(false);
      tracker.setActive('install-1', mockInstallation);
      expect(tracker.hasAnyActiveOrPending()).toBe(true);
    });
  });

  describe('Cleanup Methods', () => {
    const mockInstallation: IActiveInstallation = {
      installId: 'collection1:dl1',
      archiveId: 'dl1',
      archivePath: '/path/to/archive.zip',
      modId: 'mod-1',
      gameId: 'game-1',
      callback: jest.fn(),
      startTime: Date.now(),
      baseName: 'test-mod',
    };

    const mockDependency = {
      download: 'dl-1',
      reference: { id: 'ref-1' },
      lookupResults: [],
    } as any;

    it('should cleanup installations for a source mod', () => {
      tracker.setActive('collection1:dl1', mockInstallation);
      tracker.setActive('collection1:dl2', { ...mockInstallation, archiveId: 'dl2' });
      tracker.setActive('collection2:dl1', { ...mockInstallation, archiveId: 'dl3' });
      tracker.setPending('collection1:dl3', mockDependency);

      const result = tracker.cleanupForSourceMod('collection1');

      expect(result.active).toBe(2);
      expect(result.pending).toBe(1);
      expect(tracker.getActiveCount()).toBe(1); // collection2 remains
      expect(tracker.getPendingCount()).toBe(0);
    });
  });

  describe('Debug Methods', () => {
    it('should provide debug info for active installations', () => {
      const now = Date.now();
      const installation: IActiveInstallation = {
        installId: 'i1',
        archiveId: 'a1',
        archivePath: '/path',
        modId: 'mod1',
        gameId: 'game1',
        callback: jest.fn(),
        startTime: now - 60000, // 1 minute ago
        baseName: 'test',
      };
      tracker.setActive('i1', installation);

      const debug = tracker.debugActiveInstalls();
      expect(debug).toHaveLength(1);
      expect(debug[0].installId).toBe('i1');
      expect(debug[0].modId).toBe('mod1');
      expect(debug[0].durationMs).toBeGreaterThanOrEqual(60000);
      expect(debug[0].durationMinutes).toBeGreaterThanOrEqual(1);
    });

    it('should provide debug summary', () => {
      const mockInstallation: IActiveInstallation = {
        installId: 'i1',
        archiveId: 'a1',
        archivePath: '/path',
        modId: 'mod1',
        gameId: 'game1',
        callback: jest.fn(),
        startTime: Date.now(),
        baseName: 'test',
      };
      const mockDependency = { download: 'd1', reference: {}, lookupResults: [] } as any;

      tracker.setActive('key1', mockInstallation);
      tracker.setPending('key2', mockDependency);

      const summary = tracker.debugSummary();
      expect(summary.activeCount).toBe(1);
      expect(summary.pendingCount).toBe(1);
      expect(summary.activeKeys).toContain('key1');
      expect(summary.pendingKeys).toContain('key2');
    });
  });

  describe('forceCleanupStuckInstalls', () => {
    it('should cleanup installations older than maxAgeMinutes', () => {
      const callback = jest.fn();
      const oldInstallation: IActiveInstallation = {
        installId: 'old-install',
        archiveId: 'a1',
        archivePath: '/path',
        modId: 'mod1',
        gameId: 'game1',
        callback,
        startTime: Date.now() - 15 * 60 * 1000, // 15 minutes ago
        baseName: 'old-mod',
      };

      const newInstallation: IActiveInstallation = {
        installId: 'new-install',
        archiveId: 'a2',
        archivePath: '/path2',
        modId: 'mod2',
        gameId: 'game1',
        callback: jest.fn(),
        startTime: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        baseName: 'new-mod',
      };

      tracker.setActive('old-install', oldInstallation);
      tracker.setActive('new-install', newInstallation);

      const mockApi = {
        store: {
          dispatch: jest.fn(),
        },
      } as any;

      const cleaned = tracker.forceCleanupStuckInstalls(mockApi, 10);

      expect(cleaned).toBe(1);
      expect(tracker.hasActive('old-install')).toBe(false);
      expect(tracker.hasActive('new-install')).toBe(true);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'InstallationTimeoutError' }),
        'mod1'
      );
    });
  });
});
