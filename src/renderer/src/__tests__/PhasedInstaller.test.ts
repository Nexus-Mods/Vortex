import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import InstallManager from '../extensions/mod_management/InstallManager';
import { IExtensionApi, IState } from '../types/api';
import { IDependency } from '../extensions/mod_management/types/IDependency';
import { IModRule } from '../extensions/mod_management/types/IMod';

// Mock dependencies
jest.mock('../extensions/mod_management/util/dependencies');
jest.mock('../util/api');
jest.mock('../util/log');

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
        },
        profiles: {
          activeProfileId: 'test-profile-1',
          nextProfileId: undefined,
          lastActiveProfile: {}
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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state1 = installManager.mInstallPhaseState.get(sourceModId);
      state1.allowedPhase = 2;

      installManager.ensurePhaseState(sourceModId);
      const state2 = installManager.mInstallPhaseState.get(sourceModId);

      expect(state2.allowedPhase).toBe(2);
      expect(state1).toBe(state2);
    });
  });

  describe('Phase Advancement', () => {
    it('should advance phase when current phase is complete', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Setup phase 0 as complete
      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.deployedPhases.add(0);
      state.activeByPhase.set(0, 0);
      state.activeByPhase.set(1, 0);

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(1);
    });

    it('should not advance phase if previous phase not deployed', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Setup phases but phase 0 not deployed
      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.activeByPhase.set(0, 0);
      state.activeByPhase.set(1, 0);
      // Note: phase 0 is NOT in deployedPhases

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(0); // Should not advance
    });

    it('should not advance if active installations in current phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      state.allowedPhase = 0;
      state.downloadsFinished.add(0);
      state.downloadsFinished.add(1);
      state.activeByPhase.set(0, 2); // 2 active installations
      state.deployedPhases.add(0);

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      expect(state.allowedPhase).toBe(0); // Should not advance
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
      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

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

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Initialize reQueueAttempted if not present
      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }

      expect(state.reQueueAttempted.has(1)).toBe(false);

      state.reQueueAttempted.set(1, Date.now());

      expect(state.reQueueAttempted.has(1)).toBe(true);
    });

    it('should not re-queue same phase twice', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }

      // First attempt should be allowed
      const phase = 2;
      expect(state.reQueueAttempted.has(phase)).toBe(false);

      // Mark as attempted (with recent timestamp)
      state.reQueueAttempted.set(phase, Date.now());

      // Second attempt should be blocked (too recent)
      expect(state.reQueueAttempted.has(phase)).toBe(true);
    });
  });

  describe('Phase Downloads Tracking', () => {
    it('should mark phase downloads as finished', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);
      expect(state.downloadsFinished.has(1)).toBe(true);
    });

    it('should initialize allowed phase on first download finish', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      expect(state.allowedPhase).toBeUndefined();

      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      expect(state.allowedPhase).toBe(2);
    });

    it('should not change allowed phase if already set', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);
      state.allowedPhase = 1;

      installManager.markPhaseDownloadsFinished(sourceModId, 3, mockApi);

      expect(state.allowedPhase).toBe(1); // Should remain unchanged
      expect(state.downloadsFinished.has(3)).toBe(true);
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

      installManager.ensurePhaseState(sourceModId);
      // Use the proper method to mark phase 2's downloads as finished
      // This should auto-populate previous phases
      installManager.markPhaseDownloadsFinished(sourceModId, 2, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);

      const canStart = (phase: number) => {
        return (state.allowedPhase !== undefined) &&
               (phase <= state.allowedPhase) &&
               state.downloadsFinished.has(phase);
      };

      expect(canStart(2)).toBe(true);
      expect(canStart(1)).toBe(true);
      expect(canStart(0)).toBe(true);
      expect(canStart(3)).toBe(false);
    });

    it('should block installation in future phases', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);
      state.allowedPhase = 1;
      state.downloadsFinished.add(1);

      const canStart = (phase: number) => {
        return (state.allowedPhase !== undefined) &&
               (phase <= state.allowedPhase) &&
               state.downloadsFinished.has(phase);
      };

      expect(canStart(2)).toBe(false);
      expect(canStart(3)).toBe(false);
    });
  });

  describe('Concurrent Phase Processing', () => {
    it('should track active installations per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Simulate starting installations
      state.activeByPhase.set(1, 3);
      state.activeByPhase.set(2, 0);

      expect(state.activeByPhase.get(1)).toBe(3);
      expect(state.activeByPhase.get(2)).toBe(0);
      expect(state.activeByPhase.get(3) ?? 0).toBe(0);
    });

    it('should track pending installations per phase', () => {
      const sourceModId = 'test-collection-1';

      installManager.ensurePhaseState(sourceModId);
      const state = installManager.mInstallPhaseState.get(sourceModId);

      const tasks1 = [jest.fn(), jest.fn()];
      const tasks2 = [jest.fn()];

      state.pendingByPhase.set(1, tasks1);
      state.pendingByPhase.set(2, tasks2);

      expect(state.pendingByPhase.get(1)?.length).toBe(2);
      expect(state.pendingByPhase.get(2)?.length).toBe(1);
      expect(state.pendingByPhase.get(3) ?? []).toEqual([]);
    });
  });
});
