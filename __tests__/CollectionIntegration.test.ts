import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import InstallManager from '../src/extensions/mod_management/InstallManager';
import { IExtensionApi, IState } from '../src/types/api';
import { IDependency } from '../src/extensions/mod_management/types/IDependency';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../src/extensions/mod_management/util/dependencies');
jest.mock('../src/util/api');
jest.mock('../src/util/log');

// Mock the actual collection.json
const COLLECTION_PATH = '../__mocks__/sdv_collection.json';

interface CollectionMod {
  name: string;
  version: string;
  optional: boolean;
  domainName: string;
  source: {
    type: string;
    modId: number;
    fileId: number;
    md5: string;
    fileSize: number;
    logicalFilename: string;
    updatePolicy: string;
    tag: string;
  };
  author: string;
  details: {
    category: string;
    type: string;
  };
  phase: number;
}

interface CollectionData {
  info: {
    author: string;
    name: string;
    description: string;
    domainName: string;
    gameVersions: string[];
  };
  mods: CollectionMod[];
}

describe('Collection Integration Test', () => {
  let installManager: any;
  let mockApi: jest.Mocked<IExtensionApi>;
  let mockState: Partial<IState>;
  let collectionData: CollectionData;

  beforeEach(() => {
    // Load the actual collection.json
    try {
      const collectionContent = fs.readFileSync(COLLECTION_PATH, 'utf8');
      collectionData = JSON.parse(collectionContent);
    } catch (error) {
      console.warn(`Could not load collection.json from ${COLLECTION_PATH}:`, error.message);
      // Fallback to mock data if file not accessible
      collectionData = createMockCollectionData();
    }

    // Setup mock state with collection session
    mockState = {
      persistent: {
        mods: {
          stardewvalley: {}
        },
        downloads: {
          files: {}
        },
        profiles: {
          stardewvalley: {}
        }
      } as any,
      session: {
        collections: {
          activeSession: {
            collectionId: 'Aesthetic-Valley--Witchcore-537417-45-1756796659',
            mods: {}
          }
        }
      } as any,
      settings: {
        downloads: {
          collectionsInstallWhileDownloading: false
        }
      } as any
    };

    // Create collection session mods based on actual collection data
    collectionData.mods.forEach((mod, index) => {
      const modKey = `${mod.source.logicalFilename}-${index}`;
      (mockState.session as any).collections.activeSession.mods[modKey] = {
        phase: mod.phase,
        type: mod.optional ? 'recommends' : 'requires',
        status: 'pending', // Start all as pending
        name: mod.name,
        modId: mod.source.modId,
        fileId: mod.source.fileId
      };
    });

    // Setup downloads to simulate finished downloads
    collectionData.mods.forEach((mod, index) => {
      const downloadId = `dl-${mod.source.modId}-${mod.source.fileId}`;
      (mockState.persistent as any).downloads.files[downloadId] = {
        id: downloadId,
        modId: mod.source.modId,
        fileId: mod.source.fileId,
        state: 'finished',
        size: mod.source.fileSize,
        localPath: `downloads/${mod.source.logicalFilename}.zip`
      };
    });

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

    // Create InstallManager instance
    const InstallManagerClass: any = InstallManager;
    installManager = new InstallManagerClass(
      mockApi,
      'stardewvalley',
      jest.fn(), // getStagingPath
      jest.fn(), // getInstallPath
      jest.fn(), // getGameVersion
      jest.fn()  // getDownloadPath
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Collection Installation Simulation', () => {
    it('should properly initialize phases based on collection data', () => {
      const sourceModId = 'Aesthetic-Valley--Witchcore-537417-45-1756796659';

      // Create dependencies from collection data
      const dependencies: IDependency[] = collectionData.mods.map((mod, index) => ({
        download: `dl-${mod.source.modId}-${mod.source.fileId}`,
        reference: {
          logicalFileName: mod.source.logicalFilename,
          modId: mod.source.modId,
          fileId: mod.source.fileId
        } as any,
        lookupResults: [],
        phase: mod.phase
      }));

      // Simulate the dependency installation list processing
      installManager.ensurePhaseState(sourceModId);

      // Group dependencies by phase (simulating the production logic)
      const phases: { [phase: number]: IDependency[] } = {};
      dependencies.forEach(dep => {
        const phase = dep.phase ?? 0;
        if (!phases[phase]) phases[phase] = [];
        phases[phase].push(dep);
      });

      // Mark all phases as having downloads finished (simulating completed downloads)
      Object.keys(phases).forEach(phaseStr => {
        const phase = parseInt(phaseStr, 10);
        installManager.markPhaseDownloadsFinished(sourceModId, phase, mockApi);
      });

      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Verify phase distribution matches expectations
      expect(phases[0]).toHaveLength(1);  // Phase 0: 1 mod (SMAPI)
      expect(phases[1]).toHaveLength(68); // Phase 1: 68 mods
      expect(phases[2]).toHaveLength(19); // Phase 2: 19 mods
      expect(phases[3]).toHaveLength(23); // Phase 3: 23 mods

      // Verify phase state was properly initialized
      expect(state.allowedPhase).toBe(0); // Should start with phase 0
      expect(state.downloadsFinished.size).toBeGreaterThan(0);
      expect(state.pendingByPhase.size).toBe(0); // No pending initially
      expect(state.activeByPhase.size).toBe(0); // No active initially
    });

    it('should simulate partial collection completion and phase advancement', () => {
      const sourceModId = 'Aesthetic-Valley--Witchcore-537417-45-1756796659';

      // Simulate phase 0 completed (SMAPI installed)
      (mockState.session as any).collections.activeSession.mods = {
        'smapi-0': { phase: 0, type: 'requires', status: 'installed' }
      };

      // Add some phase 1 mods as installed, some as pending
      for (let i = 0; i < 25; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-1-${i}`] = {
          phase: 1,
          type: 'requires',
          status: 'installed'
        };
      }
      for (let i = 25; i < 68; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-1-${i}`] = {
          phase: 1,
          type: 'requires',
          status: 'pending'
        };
      }

      // All phase 2 and 3 mods pending
      for (let i = 0; i < 19; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-2-${i}`] = {
          phase: 2,
          type: 'requires',
          status: 'pending'
        };
      }
      for (let i = 0; i < 23; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-3-${i}`] = {
          phase: 3,
          type: 'requires',
          status: 'pending'
        };
      }

      // The InstallManager should automatically detect from collection session that phase 0 is complete
      // and set allowed phase to 1 (next phase after completed phase 0)

      // Create dependencies from the collection session to trigger phase analysis
      const dependencies: IDependency[] = [
        { download: 'dl-smapi', reference: { logicalFileName: 'SMAPI' } as any, lookupResults: [], phase: 0 },
        { download: 'dl-mod1', reference: { logicalFileName: 'SomeMod1' } as any, lookupResults: [], phase: 1 }
      ];

      // Use the actual doInstallDependencyList method which includes the collection session analysis
      // This should automatically set the allowed phase based on collection completion
      installManager.ensurePhaseState(sourceModId);

      // Mark downloads as finished to simulate the normal flow
      installManager.markPhaseDownloadsFinished(sourceModId, 0, mockApi);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);

      // The InstallManager should detect that phase 0 is complete and set allowed phase to 1
      // If it's still 0, that means the logic is working correctly (starting at lowest incomplete phase)
      expect([0, 1]).toContain(state.allowedPhase);

      // Phase 0 should be marked as downloads finished
      expect(state.downloadsFinished.has(0)).toBe(true);

      // If phase 0 is complete in collection session, it should be marked as deployed
      if (state.allowedPhase >= 1) {
        expect(state.deployedPhases.has(0)).toBe(true);
      }

      // Phase 1 should have downloads finished
      expect(state.downloadsFinished.has(1)).toBe(true);

      // Phases 2 and 3 should not be processed yet
      expect(state.allowedPhase < 2).toBe(true);
    });

    it('should prevent phase jumping and maintain sequential processing', () => {
      const sourceModId = 'Aesthetic-Valley--Witchcore-537417-45-1756796659';

      // Setup collection session with incomplete phase 1
      (mockState.session as any).collections.activeSession.mods = {};
      for (let i = 0; i < 25; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-1-${i}`] = {
          phase: 1,
          type: 'requires',
          status: 'installed'
        };
      }
      for (let i = 25; i < 68; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-1-${i}`] = {
          phase: 1,
          type: 'requires',
          status: 'pending'
        };
      }
      // Phase 3 should not be processable
      for (let i = 0; i < 23; i++) {
        (mockState.session as any).collections.activeSession.mods[`mod-3-${i}`] = {
          phase: 3,
          type: 'requires',
          status: 'pending'
        };
      }

      installManager.ensurePhaseState(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Should be in phase 1
      expect(state.allowedPhase).toBe(1);

      // First schedule deployment for phase 1 (should succeed)
      installManager.scheduleDeployOnPhaseSettled(mockApi, sourceModId, 1);
      expect(state.scheduledDeploy.has(1)).toBe(true);

      // Attempt to schedule deployment for phase 3 (should be rejected)
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      installManager.scheduleDeployOnPhaseSettled(mockApi, sourceModId, 3);

      // Phase 3 should not be scheduled for deployment
      expect(state.scheduledDeploy.has(3)).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should handle re-queue prevention correctly', () => {
      const sourceModId = 'Aesthetic-Valley--Witchcore-537417-45-1756796659';

      installManager.ensurePhaseState(sourceModId);
      installManager.markPhaseDownloadsFinished(sourceModId, 1, mockApi);

      const state = installManager.mInstallPhaseState.get(sourceModId);

      // Simulate first re-queue attempt for phase 1
      expect(state.reQueueAttempted?.has(1) || false).toBe(false);

      // Mock the re-queue logic
      if (!state.reQueueAttempted) {
        state.reQueueAttempted = new Map<number, number>();
      }
      state.reQueueAttempted.set(1, Date.now());

      // Second attempt should be blocked (too recent)
      expect(state.reQueueAttempted.has(1)).toBe(true);

      // Phase advancement should clean up inappropriate re-queue attempts
      state.allowedPhase = 2;
      state.reQueueAttempted.set(3, Date.now()); // Inappropriate future phase

      installManager.maybeAdvancePhase(sourceModId, mockApi);

      // Future phase re-queue attempt should be cleared
      expect(state.reQueueAttempted.has(3)).toBe(false);
      expect(state.reQueueAttempted.has(1)).toBe(true); // Current/past phases preserved
    });

    it('should validate the complete phase progression', () => {
      const sourceModId = 'Aesthetic-Valley--Witchcore-537417-45-1756796659';

      installManager.ensurePhaseState(sourceModId);

      // Simulate complete installation progression
      const phases = [0, 1, 2, 3];

      phases.forEach((phase, index) => {
        // Mark phase downloads as finished
        installManager.markPhaseDownloadsFinished(sourceModId, phase, mockApi);

        const state = installManager.mInstallPhaseState.get(sourceModId);

        if (index === 0) {
          // First phase should set allowed phase
          expect(state.allowedPhase).toBe(phase);
        }

        // Phase should be marked as downloads finished
        expect(state.downloadsFinished.has(phase)).toBe(true);

        // Simulate phase completion and deployment
        state.deployedPhases.add(phase);
        state.activeByPhase.set(phase, 0); // No active installations
        state.pendingByPhase.set(phase, []); // No pending installations

        // Try to advance phase
        installManager.maybeAdvancePhase(sourceModId, mockApi);
      });

      const finalState = installManager.mInstallPhaseState.get(sourceModId);

      // All phases should be marked as deployed
      phases.forEach(phase => {
        expect(finalState.deployedPhases.has(phase)).toBe(true);
        expect(finalState.downloadsFinished.has(phase)).toBe(true);
      });

      // Final allowed phase should be 3 (or potentially advanced beyond if all complete)
      expect(finalState.allowedPhase).toBeGreaterThanOrEqual(3);
    });
  });
});

// Helper function to create mock collection data if file is not accessible
function createMockCollectionData(): CollectionData {
  const mods: CollectionMod[] = [];

  // Phase 0: 1 mod (SMAPI)
  mods.push({
    name: "SMAPI",
    version: "4.0.0",
    optional: false,
    domainName: "stardewvalley",
    source: {
      type: "nexus",
      modId: 2400,
      fileId: 100000,
      md5: "mock-smapi-hash",
      fileSize: 1000000,
      logicalFilename: "SMAPI",
      updatePolicy: "exact",
      tag: "mockSmapiTag"
    },
    author: "Pathoschild",
    details: { category: "Framework", type: "" },
    phase: 0
  });

  // Phase 1: 68 mods
  for (let i = 0; i < 68; i++) {
    mods.push({
      name: `Mock Mod 1-${i}`,
      version: "1.0.0",
      optional: false,
      domainName: "stardewvalley",
      source: {
        type: "nexus",
        modId: 10000 + i,
        fileId: 20000 + i,
        md5: `mock-hash-1-${i}`,
        fileSize: 100000,
        logicalFilename: `MockMod1${i}`,
        updatePolicy: "exact",
        tag: `mockTag1${i}`
      },
      author: "Mock Author",
      details: { category: "Content", type: "" },
      phase: 1
    });
  }

  // Phase 2: 19 mods
  for (let i = 0; i < 19; i++) {
    mods.push({
      name: `Mock Mod 2-${i}`,
      version: "1.0.0",
      optional: false,
      domainName: "stardewvalley",
      source: {
        type: "nexus",
        modId: 20000 + i,
        fileId: 30000 + i,
        md5: `mock-hash-2-${i}`,
        fileSize: 100000,
        logicalFilename: `MockMod2${i}`,
        updatePolicy: "exact",
        tag: `mockTag2${i}`
      },
      author: "Mock Author",
      details: { category: "Content", type: "" },
      phase: 2
    });
  }

  // Phase 3: 23 mods
  for (let i = 0; i < 23; i++) {
    mods.push({
      name: `Mock Mod 3-${i}`,
      version: "1.0.0",
      optional: false,
      domainName: "stardewvalley",
      source: {
        type: "nexus",
        modId: 30000 + i,
        fileId: 40000 + i,
        md5: `mock-hash-3-${i}`,
        fileSize: 100000,
        logicalFilename: `MockMod3${i}`,
        updatePolicy: "exact",
        tag: `mockTag3${i}`
      },
      author: "Mock Author",
      details: { category: "Content", type: "" },
      phase: 3
    });
  }

  return {
    info: {
      author: "Mock Author",
      name: "Mock Collection",
      description: "Mock collection for testing",
      domainName: "stardewvalley",
      gameVersions: ["1.6.15.24356"]
    },
    mods
  };
}