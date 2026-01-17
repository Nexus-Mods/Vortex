import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  PhasedInstallCoordinator,
  checkCollectionPhaseStatus,
  canStartInstallationTasks,
} from "../../../src/extensions/mod_management/install/PhasedInstallCoordinator";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock selectors
jest.mock("../../../src/util/selectors", () => ({
  activeProfile: jest.fn((state: any) => state?.profile || { id: "profile-1", gameId: "skyrimse" }),
  profileById: jest.fn((state: any, id: string) => state?.profile || { id, gameId: "skyrimse" }),
}));

// Mock storeHelper
jest.mock("../../../src/util/storeHelper", () => ({
  getSafe: jest.fn((obj: any, path: string[], defaultVal: any) => {
    let result = obj;
    for (const key of path) {
      result = result?.[key];
      if (result === undefined) return defaultVal;
    }
    return result ?? defaultVal;
  }),
}));

// Mock BatchContext
jest.mock("../../../src/util/BatchContext", () => ({
  getBatchContext: jest.fn(() => null),
}));

// Mock collections_integration selectors
jest.mock(
  "../../../src/extensions/collections_integration/selectors",
  () => ({
    getCollectionSessionById: jest.fn((state: any, sessionId: string) =>
      state?.sessions?.[sessionId] || null,
    ),
    getCollectionStatusBreakdown: jest.fn((state: any, sessionId: string) => ({
      required: state?.breakdown?.required || { pending: 0, downloading: 0, installed: 0 },
      total: state?.breakdown?.total || { pending: 0, downloading: 0, installed: 0 },
    })),
    isCollectionPhaseComplete: jest.fn((state: any, phase: number) =>
      state?.phasesComplete?.[phase] || false,
    ),
  }),
);

// Mock collections_integration util
jest.mock(
  "../../../src/extensions/collections_integration/util",
  () => ({
    generateCollectionSessionId: jest.fn(
      (sourceModId: string, profileId: string) =>
        sourceModId && profileId ? `${sourceModId}-${profileId}` : null,
    ),
  }),
);

// Mock helpers
jest.mock(
  "../../../src/extensions/mod_management/install/helpers",
  () => ({
    getModsByPhase: jest.fn((mods: any[], phase: number) =>
      mods.filter((m: any) => (m.phase ?? 0) === phase),
    ),
    getReadyDownloadId: jest.fn(
      (
        downloads: any,
        reference: any,
        hasActiveOrPending: (id: string) => boolean,
      ) => {
        // Simple mock: look for download by tag
        for (const [id, dl] of Object.entries(downloads)) {
          if (
            (dl as any).modInfo?.referenceTag === reference?.tag &&
            !hasActiveOrPending(id)
          ) {
            return id;
          }
        }
        return null;
      },
    ),
  }),
);

// Helper to create mock API
function createMockApi(stateOverrides: any = {}) {
  const state = {
    profile: { id: "profile-1", gameId: "skyrimse" },
    persistent: {
      downloads: {
        files: {},
      },
    },
    settings: {
      downloads: {
        collectionsInstallWhileDownloading: false,
      },
    },
    sessions: {},
    ...stateOverrides,
  };

  return {
    getState: jest.fn(() => state),
  } as any;
}

// Helper to create mock PhaseManager
function createMockPhaseManager(overrides: any = {}) {
  return {
    hasState: jest.fn(() => true),
    getCachedDownloadByTag: jest.fn(() => null),
    getCachedDownloadByMd5: jest.fn(() => null),
    ...overrides,
  } as any;
}

// Helper to create mock Tracker
function createMockTracker(overrides: any = {}) {
  return {
    hasActiveOrPending: jest.fn(() => false),
    getActiveCount: jest.fn(() => 0),
    getPendingCount: jest.fn(() => 0),
    ...overrides,
  } as any;
}

describe("PhasedInstallCoordinator", () => {
  describe("checkCollectionPhaseStatus", () => {
    it("should return phaseComplete: true when no active session", () => {
      const mockApi = createMockApi({ sessions: {} });
      const mockPhaseManager = createMockPhaseManager();

      const result = checkCollectionPhaseStatus(
        mockApi,
        "source-mod",
        0,
        mockPhaseManager,
        () => false,
      );

      expect(result.phaseComplete).toBe(true);
      expect(result.needsRequeue).toBe(false);
      expect(result.allMods).toEqual([]);
    });

    it("should return correct status when session exists with mods", () => {
      const mockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: { id: "mod1", status: "installed", phase: 0 },
              mod2: { id: "mod2", status: "downloaded", phase: 0 },
            },
          },
        },
        phasesComplete: { 0: false },
      });
      const mockPhaseManager = createMockPhaseManager();

      const result = checkCollectionPhaseStatus(
        mockApi,
        "source-mod",
        0,
        mockPhaseManager,
        () => false,
      );

      expect(result.phaseComplete).toBe(false);
      expect(result.allMods).toHaveLength(2);
      expect(result.downloadedCount).toBe(1);
    });

    it("should identify mods needing requeue", () => {
      const mockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: {
                id: "mod1",
                status: "downloaded",
                phase: 0,
                rule: { reference: { tag: "tag-123" } },
              },
            },
          },
        },
        persistent: {
          downloads: {
            files: {
              "dl-123": {
                id: "dl-123",
                state: "finished",
                modInfo: { referenceTag: "tag-123" },
              },
            },
          },
        },
      });
      const mockPhaseManager = createMockPhaseManager({
        getCachedDownloadByTag: jest.fn(() => "dl-123"),
      });

      const result = checkCollectionPhaseStatus(
        mockApi,
        "source-mod",
        0,
        mockPhaseManager,
        () => false,
      );

      expect(result.needsRequeue).toBe(true);
      expect(result.modsNeedingRequeue).toBe(1);
    });

    it("should not count mods with active installations as needing requeue", () => {
      const mockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: {
                id: "mod1",
                status: "downloaded",
                phase: 0,
                rule: { reference: { tag: "tag-123" } },
              },
            },
          },
        },
        persistent: {
          downloads: {
            files: {
              "dl-123": {
                id: "dl-123",
                state: "finished",
                modInfo: { referenceTag: "tag-123" },
              },
            },
          },
        },
      });
      const mockPhaseManager = createMockPhaseManager({
        getCachedDownloadByTag: jest.fn(() => "dl-123"),
      });

      const result = checkCollectionPhaseStatus(
        mockApi,
        "source-mod",
        0,
        mockPhaseManager,
        (srcModId, downloadId) => downloadId === "dl-123", // This download is active
      );

      expect(result.needsRequeue).toBe(false);
      expect(result.modsNeedingRequeue).toBe(0);
    });

    it("should detect stuck pending state when tracker shows active=0 and pending>0", () => {
      const mockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: {
                id: "mod1",
                status: "downloaded",
                phase: 0,
                rule: { reference: { tag: "tag-123" } },
              },
            },
          },
        },
        persistent: {
          downloads: {
            files: {
              "dl-123": {
                id: "dl-123",
                state: "paused", // Not finished, but tracker has stuck pending
                modInfo: { referenceTag: "tag-123" },
              },
            },
          },
        },
      });
      const mockPhaseManager = createMockPhaseManager({
        getCachedDownloadByTag: jest.fn(() => "dl-123"),
      });
      const mockTracker = createMockTracker({
        getActiveCount: jest.fn(() => 0),
        getPendingCount: jest.fn(() => 5), // Has stuck pending
      });

      const result = checkCollectionPhaseStatus(
        mockApi,
        "source-mod",
        0,
        mockPhaseManager,
        () => false,
        mockTracker,
      );

      expect(result.needsRequeue).toBe(true);
      expect(result.modsNeedingRequeue).toBe(1);
    });
  });

  describe("canStartInstallationTasks", () => {
    it("should return true when installWhileDownloading is enabled", () => {
      const mockApi = createMockApi({
        settings: {
          downloads: {
            collectionsInstallWhileDownloading: true,
          },
        },
      });

      const result = canStartInstallationTasks(mockApi, "source-mod");

      expect(result).toBe(true);
    });

    it("should return true when no session exists", () => {
      const mockApi = createMockApi({
        profile: null, // No profile means no session can be generated
      });

      const result = canStartInstallationTasks(mockApi, "source-mod");

      expect(result).toBe(true);
    });

    it("should return false when downloads are pending", () => {
      const mockApi = createMockApi({
        breakdown: {
          required: { pending: 5, downloading: 0, installed: 10 },
          total: { pending: 5, downloading: 0, installed: 10 },
        },
      });

      const result = canStartInstallationTasks(mockApi, "source-mod");

      expect(result).toBe(false);
    });

    it("should return false when downloads are in progress", () => {
      const mockApi = createMockApi({
        breakdown: {
          required: { pending: 0, downloading: 3, installed: 10 },
          total: { pending: 0, downloading: 3, installed: 10 },
        },
      });

      const result = canStartInstallationTasks(mockApi, "source-mod");

      expect(result).toBe(false);
    });

    it("should return true when no pending or downloading", () => {
      const mockApi = createMockApi({
        breakdown: {
          required: { pending: 0, downloading: 0, installed: 10 },
          total: { pending: 0, downloading: 0, installed: 10 },
        },
      });

      const result = canStartInstallationTasks(mockApi, "source-mod");

      expect(result).toBe(true);
    });

    it("should check total counts when allowOptional is true", () => {
      const mockApi = createMockApi({
        breakdown: {
          required: { pending: 0, downloading: 0, installed: 10 },
          total: { pending: 2, downloading: 0, installed: 10 }, // Optional mods pending
        },
      });

      // Without allowOptional - should be true (required has no pending)
      const resultRequired = canStartInstallationTasks(
        mockApi,
        "source-mod",
        false,
      );
      expect(resultRequired).toBe(true);

      // With allowOptional - should be false (total has pending)
      const resultTotal = canStartInstallationTasks(
        mockApi,
        "source-mod",
        true,
      );
      expect(resultTotal).toBe(false);
    });
  });

  describe("PhasedInstallCoordinator class", () => {
    let coordinator: PhasedInstallCoordinator;
    let mockApi: any;
    let mockPhaseManager: any;
    let mockTracker: any;

    beforeEach(() => {
      mockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: { id: "mod1", status: "installed", phase: 0 },
            },
          },
        },
      });
      mockPhaseManager = createMockPhaseManager();
      mockTracker = createMockTracker();
      coordinator = new PhasedInstallCoordinator(
        mockApi,
        mockPhaseManager,
        mockTracker,
      );
    });

    it("should provide checkPhaseStatus method", () => {
      const result = coordinator.checkPhaseStatus("source-mod", 0);

      expect(result).toHaveProperty("phaseComplete");
      expect(result).toHaveProperty("needsRequeue");
      expect(result).toHaveProperty("allMods");
    });

    it("should provide canStartTasks method", () => {
      const result = coordinator.canStartTasks("source-mod");

      expect(typeof result).toBe("boolean");
    });

    it("should pass tracker to checkPhaseStatus for stuck pending detection", () => {
      mockTracker.getActiveCount.mockReturnValue(0);
      mockTracker.getPendingCount.mockReturnValue(5);

      // Create a state where the stuck pending check would matter
      const stuckMockApi = createMockApi({
        sessions: {
          "source-mod-profile-1": {
            mods: {
              mod1: {
                id: "mod1",
                status: "downloaded",
                phase: 0,
                rule: { reference: { tag: "tag-123" } },
              },
            },
          },
        },
        persistent: {
          downloads: {
            files: {
              "dl-123": {
                id: "dl-123",
                state: "paused",
                modInfo: { referenceTag: "tag-123" },
              },
            },
          },
        },
      });
      mockPhaseManager.getCachedDownloadByTag.mockReturnValue("dl-123");

      const stuckCoordinator = new PhasedInstallCoordinator(
        stuckMockApi,
        mockPhaseManager,
        mockTracker,
      );
      const result = stuckCoordinator.checkPhaseStatus("source-mod", 0);

      expect(result.modsNeedingRequeue).toBe(1);
      expect(mockTracker.getActiveCount).toHaveBeenCalled();
      expect(mockTracker.getPendingCount).toHaveBeenCalled();
    });
  });
});
