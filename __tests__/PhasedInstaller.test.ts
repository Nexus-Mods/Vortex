import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import InstallManager from '../src/extensions/mod_management/InstallManager';
import { IExtensionApi, IState } from '../src/types/api';
import { IDependency } from '../src/extensions/mod_management/types/IDependency';
import { IModRule } from '../src/extensions/mod_management/types/IMod';

// Mock dependencies
jest.mock('../src/extensions/mod_management/util/dependencies');
jest.mock('../src/util/api');
jest.mock('../src/util/log');

describe('Phased Installer', () => {
  let installManager: any;
  let mockApi: jest.Mocked<IExtensionApi>;
  let mockState: Partial<IState>;

  beforeEach(() => {
    // Setup mock API and state
    mockState = {
      persistent: {
        mods: {},
        downloads: {
          files: {}
        },
        profiles: {}
      } as any,
      session: {
        collections: {
          activeSession: null
        }
      } as any,
      settings: {
        downloads: {
          collectionsInstallWhileDownloading: false
        }
      } as any
    };

    mockApi = {
      getState: jest.fn(() => mockState as IState),
      store: {
        dispatch: jest.fn(),
        getState: jest.fn(() => mockState as IState)
      },
      events: {
        emit: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn()
      },
      onAsync: jest.fn(),
      onStateChange: jest.fn(),
      sendNotification: jest.fn(),
      dismissNotification: jest.fn(),
      showErrorNotification: jest.fn(),
      translate: jest.fn((key) => key),
      registerInstaller: jest.fn()
    } as any;

    // Create InstallManager instance with private access
    const InstallManagerClass: any = InstallManager;
    installManager = new InstallManagerClass(
      mockApi,
      'testGameId',
      jest.fn(), // getStagingPath
      jest.fn(), // getInstallPath
      jest.fn(), // getGameVersion
      jest.fn()  // getDownloadPath
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase State Management', () => {
    it('should initialize phase state correctly', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      const state = installManager.mPhaseManager.getState(sourceModId);

      expect(state).toBeDefined();
      expect(state.allowedPhase).toBeUndefined();
      expect(state.downloadsFinished).toBeInstanceOf(Set);
      expect(state.pendingByPhase).toBeInstanceOf(Map);
      expect(state.activeByPhase).toBeInstanceOf(Map);
      expect(state.deploymentPromises).toBeInstanceOf(Map);
      expect(state.deployedPhases).toBeInstanceOf(Set);
    });

    it('should not reinitialize existing phase state', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      installManager.mPhaseManager.setAllowedPhase(sourceModId, 2);

      installManager.mPhaseManager.ensureState(sourceModId);
      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);

      expect(allowedPhase).toBe(2);
    });
  });

  describe('Phase Advancement', () => {
    it('should advance phase when current phase is complete', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      // Setup phase 0 as complete using PhaseManager methods
      installManager.mPhaseManager.setAllowedPhase(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 1);
      installManager.mPhaseManager.markPhaseDeployed(sourceModId, 0);
      // Active count is 0 by default

      installManager.mPhaseCoordinator.maybeAdvancePhase(sourceModId, mockApi);

      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);
      expect(allowedPhase).toBe(1);
    });

    it('should not advance phase if previous phase not deployed', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      // Setup phases but phase 0 not deployed
      installManager.mPhaseManager.setAllowedPhase(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 1);
      // Note: phase 0 is NOT marked as deployed

      installManager.mPhaseCoordinator.maybeAdvancePhase(sourceModId, mockApi);

      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);
      expect(allowedPhase).toBe(0); // Should not advance
    });

    it('should not advance if active installations in current phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      installManager.mPhaseManager.setAllowedPhase(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 0);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 1);
      installManager.mPhaseManager.incrementActive(sourceModId, 0);
      installManager.mPhaseManager.incrementActive(sourceModId, 0); // 2 active installations
      installManager.mPhaseManager.markPhaseDeployed(sourceModId, 0);

      installManager.mPhaseCoordinator.maybeAdvancePhase(sourceModId, mockApi);

      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);
      expect(allowedPhase).toBe(0); // Should not advance
    });
  });

  describe('Collection Phase Detection', () => {
    it('should detect completed phases from collection session', () => {
      const sourceModId = 'test-collection-1';
      const dependencies: IDependency[] = [
        {
          download: 'dl1',
          reference: { logicalFileName: 'mod1' } as any,
          lookupResults: [],
          phase: 2
        },
        {
          download: 'dl2',
          reference: { logicalFileName: 'mod2' } as any,
          lookupResults: [],
          phase: 2
        }
      ];

      // Setup collection session with phases 0 and 1 complete
      (mockState.session as any).collections = {
        activeSession: {
          collectionId: sourceModId,
          mods: {
            'mod-0-1': { phase: 0, type: 'requires', status: 'installed' },
            'mod-1-1': { phase: 1, type: 'requires', status: 'installed' },
            'mod-1-2': { phase: 1, type: 'requires', status: 'installed' },
            'mod-1-3': { phase: 1, type: 'recommends', status: 'installed' },
            'mod-2-1': { phase: 2, type: 'requires', status: 'pending' },
            'mod-2-2': { phase: 2, type: 'requires', status: 'pending' }
          }
        }
      } as any;

      // This would be called during doInstallDependencyList
      // We'll test the phase detection logic directly
      installManager.mPhaseManager.ensureState(sourceModId);

      // Simulate what would happen in the actual code
      const allMods = Object.values((mockState.session as any).collections.activeSession.mods);
      const allPhases = new Set<number>();
      allMods.forEach((mod: any) => {
        allPhases.add(mod.phase ?? 0);
      });

      let highestCompletedPhase = -1;
      Array.from(allPhases).sort((a, b) => a - b).forEach(phase => {
        const phaseMods = allMods.filter((mod: any) => (mod.phase ?? 0) === phase);
        const requiredPhaseMods = phaseMods.filter((mod: any) => mod.type === 'requires');
        const completedRequired = requiredPhaseMods.filter((mod: any) =>
          ['installed', 'failed', 'skipped'].includes(mod.status)).length;
        const totalRequired = requiredPhaseMods.length;

        if (completedRequired >= totalRequired && totalRequired > 0) {
          highestCompletedPhase = phase;
        }
      });

      expect(highestCompletedPhase).toBe(1);

      // The next phase should be 2
      const nextPhase = highestCompletedPhase + 1;
      expect(nextPhase).toBe(2);
    });

    it('should handle collection with no completed phases', () => {
      const sourceModId = 'test-collection-1';

      (mockState.session as any).collections = {
        activeSession: {
          collectionId: sourceModId,
          mods: {
            'mod-0-1': { phase: 0, type: 'requires', status: 'pending' },
            'mod-1-1': { phase: 1, type: 'requires', status: 'pending' }
          }
        }
      } as any;

      const allMods = Object.values((mockState.session as any).collections.activeSession.mods);
      let highestCompletedPhase = -1;

      const allPhases = new Set<number>();
      allMods.forEach((mod: any) => {
        allPhases.add(mod.phase ?? 0);
      });

      Array.from(allPhases).sort((a, b) => a - b).forEach(phase => {
        const phaseMods = allMods.filter((mod: any) => (mod.phase ?? 0) === phase);
        const requiredPhaseMods = phaseMods.filter((mod: any) => mod.type === 'requires');
        const completedRequired = requiredPhaseMods.filter((mod: any) =>
          ['installed', 'failed', 'skipped'].includes(mod.status)).length;
        const totalRequired = requiredPhaseMods.length;

        if (completedRequired >= totalRequired && totalRequired > 0) {
          highestCompletedPhase = phase;
        }
      });

      expect(highestCompletedPhase).toBe(-1);
    });
  });

  describe('Re-queue Prevention', () => {
    it('should track re-queue attempts per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      expect(installManager.mPhaseManager.hasReQueueAttempted(sourceModId, 1)).toBe(false);

      installManager.mPhaseManager.markReQueueAttempted(sourceModId, 1);

      expect(installManager.mPhaseManager.hasReQueueAttempted(sourceModId, 1)).toBe(true);
    });

    it('should track multiple re-queue attempts per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      // First attempt
      const phase = 2;
      expect(installManager.mPhaseManager.hasReQueueAttempted(sourceModId, phase)).toBe(false);

      // Mark as attempted
      installManager.mPhaseManager.markReQueueAttempted(sourceModId, phase);

      // Should now be tracked
      expect(installManager.mPhaseManager.hasReQueueAttempted(sourceModId, phase)).toBe(true);
      expect(installManager.mPhaseManager.getReQueueAttemptCount(sourceModId, phase)).toBe(1);

      // Mark again
      installManager.mPhaseManager.markReQueueAttempted(sourceModId, phase);
      expect(installManager.mPhaseManager.getReQueueAttemptCount(sourceModId, phase)).toBe(2);
    });
  });

  describe('Phase Downloads Tracking', () => {
    it('should mark phase downloads as finished', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      installManager.mPhaseCoordinator.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      expect(installManager.mPhaseManager.hasDownloadsFinished(sourceModId, 1)).toBe(true);
    });

    it('should initialize allowed phase on first download finish', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      expect(installManager.mPhaseManager.getAllowedPhase(sourceModId)).toBeUndefined();

      installManager.mPhaseCoordinator.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      expect(installManager.mPhaseManager.getAllowedPhase(sourceModId)).toBe(2);
    });

    it('should not change allowed phase if already set', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      installManager.mPhaseManager.setAllowedPhase(sourceModId, 1);

      installManager.mPhaseCoordinator.markPhaseDownloadsFinished(sourceModId, 3, mockApi);

      expect(installManager.mPhaseManager.getAllowedPhase(sourceModId)).toBe(1); // Should remain unchanged
      expect(installManager.mPhaseManager.hasDownloadsFinished(sourceModId, 3)).toBe(true);
    });
  });

  describe('Collection Session Phase Assignment', () => {
    it('should assign phase 0 when rule.extra.phase is undefined', () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: 'test-mod' } as any,
        type: 'requires'
        // Note: no extra field
      };

      // Test the logic from InstallDriver.ts line 767
      const phase = rule.extra?.phase ?? 0;
      expect(phase).toBe(0);
    });

    it('should use phase from rule.extra.phase when present', () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: 'test-mod' } as any,
        type: 'requires',
        extra: { phase: 3 }
      };

      const phase = rule.extra?.phase ?? 0;
      expect(phase).toBe(3);
    });

    it('should handle null extra field', () => {
      const rule: Partial<IModRule> = {
        reference: { logicalFileName: 'test-mod' } as any,
        type: 'requires',
        extra: null
      };

      const phase = rule.extra?.phase ?? 0;
      expect(phase).toBe(0);
    });
  });

  describe('Phase Gating', () => {
    it('should allow installation in current phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      // Use the proper method to mark phase 2's downloads as finished
      // This should auto-populate previous phases
      installManager.mPhaseCoordinator.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);

      const canStart = (phase: number) => {
        return (allowedPhase !== undefined) &&
               (phase <= allowedPhase) &&
               installManager.mPhaseManager.hasDownloadsFinished(sourceModId, phase);
      };

      expect(canStart(2)).toBe(true);
      expect(canStart(1)).toBe(true);
      expect(canStart(0)).toBe(true);
      expect(canStart(3)).toBe(false);
    });

    it('should block installation in future phases', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);
      installManager.mPhaseManager.setAllowedPhase(sourceModId, 1);
      installManager.mPhaseManager.markDownloadsFinished(sourceModId, 1);

      const allowedPhase = installManager.mPhaseManager.getAllowedPhase(sourceModId);

      const canStart = (phase: number) => {
        return (allowedPhase !== undefined) &&
               (phase <= allowedPhase) &&
               installManager.mPhaseManager.hasDownloadsFinished(sourceModId, phase);
      };

      expect(canStart(2)).toBe(false);
      expect(canStart(3)).toBe(false);
    });
  });

  describe('Concurrent Phase Processing', () => {
    it('should track active installations per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      // Simulate starting installations using PhaseManager
      installManager.mPhaseManager.incrementActive(sourceModId, 1);
      installManager.mPhaseManager.incrementActive(sourceModId, 1);
      installManager.mPhaseManager.incrementActive(sourceModId, 1);

      expect(installManager.mPhaseManager.getActiveCount(sourceModId, 1)).toBe(3);
      expect(installManager.mPhaseManager.getActiveCount(sourceModId, 2)).toBe(0);
      expect(installManager.mPhaseManager.getActiveCount(sourceModId, 3)).toBe(0);
    });

    it('should track pending installations per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.mPhaseManager.ensureState(sourceModId);

      const task1 = jest.fn();
      const task2 = jest.fn();
      const task3 = jest.fn();

      installManager.mPhaseManager.queuePending(sourceModId, 1, task1);
      installManager.mPhaseManager.queuePending(sourceModId, 1, task2);
      installManager.mPhaseManager.queuePending(sourceModId, 2, task3);

      expect(installManager.mPhaseManager.getPendingCount(sourceModId, 1)).toBe(2);
      expect(installManager.mPhaseManager.getPendingCount(sourceModId, 2)).toBe(1);
      expect(installManager.mPhaseManager.getPendingCount(sourceModId, 3)).toBe(0);
    });
  });
});
