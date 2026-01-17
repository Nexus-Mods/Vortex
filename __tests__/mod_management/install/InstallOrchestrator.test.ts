import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  InstallOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from "../../../src/extensions/mod_management/install/InstallOrchestrator";
import { InstallationTracker } from "../../../src/extensions/mod_management/install/InstallationTracker";
import { PhaseManager } from "../../../src/extensions/mod_management/install/PhaseManager";
import type { IActiveInstallation } from "../../../src/extensions/mod_management/install/types/IInstallationEntry";
import type { IDependency } from "../../../src/extensions/mod_management/types/IDependency";
import type { IMod, IModReference } from "../../../src/extensions/mod_management/types/IMod";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock node-7z
jest.mock("node-7z", () => {
  return jest.fn().mockImplementation(() => ({
    extractFull: jest.fn(),
  }));
});

// Helper to create mock installation info
function createMockInstallation(
  overrides: Partial<IActiveInstallation> = {},
): IActiveInstallation {
  return {
    installId: "test-install-1",
    archiveId: "archive-123",
    archivePath: "/path/to/archive.zip",
    modId: "test-mod",
    gameId: "skyrimse",
    callback: jest.fn() as unknown as (error: Error, id: string) => void,
    startTime: Date.now(),
    baseName: "TestMod",
    ...overrides,
  };
}

// Helper to create mock dependency
function createMockDependency(
  overrides: Partial<IDependency> = {},
): IDependency {
  return {
    download: "dl-123",
    reference: { logicalFileName: "test-mod" },
    lookupResults: [],
    ...overrides,
  } as IDependency;
}

describe("InstallOrchestrator", () => {
  let orchestrator: InstallOrchestrator;

  beforeEach(() => {
    orchestrator = new InstallOrchestrator();
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      const config = orchestrator.getConfig();
      expect(config).toEqual(DEFAULT_ORCHESTRATOR_CONFIG);
    });

    it("should allow custom config", () => {
      const custom = new InstallOrchestrator({
        maxSimultaneousInstalls: 10,
        maxDependencyDownloads: 20,
      });
      const config = custom.getConfig();
      expect(config.maxSimultaneousInstalls).toBe(10);
      expect(config.maxDependencyDownloads).toBe(20);
      // Other values should be defaults
      expect(config.maxDependencyRetries).toBe(
        DEFAULT_ORCHESTRATOR_CONFIG.maxDependencyRetries,
      );
    });
  });

  describe("component access", () => {
    it("should provide access to tracker", () => {
      const tracker = orchestrator.getTracker();
      expect(tracker).toBeInstanceOf(InstallationTracker);
    });

    it("should provide access to phase manager", () => {
      const phaseManager = orchestrator.getPhaseManager();
      expect(phaseManager).toBeInstanceOf(PhaseManager);
    });

    it("should provide access to extractor", () => {
      const extractor = orchestrator.getExtractor();
      expect(extractor).toBeDefined();
    });

    it("should provide access to instruction processor", () => {
      const processor = orchestrator.getInstructionProcessor();
      expect(processor).toBeDefined();
    });
  });

  describe("installation tracking", () => {
    it("should register installation", () => {
      const info = createMockInstallation();
      orchestrator.registerInstallation("install-1", info);

      expect(orchestrator.isInstallationActive("install-1")).toBe(true);
      expect(orchestrator.getActiveInstallationCount()).toBe(1);
    });

    it("should complete installation successfully", () => {
      const info = createMockInstallation();
      orchestrator.registerInstallation("install-1", info);

      orchestrator.completeInstallation("install-1", "mod-123");

      expect(orchestrator.isInstallationActive("install-1")).toBe(false);
      expect(orchestrator.getActiveInstallationCount()).toBe(0);
    });

    it("should complete installation with error", () => {
      const info = createMockInstallation();
      orchestrator.registerInstallation("install-1", info);

      orchestrator.completeInstallation(
        "install-1",
        undefined,
        new Error("Test error"),
      );

      expect(orchestrator.isInstallationActive("install-1")).toBe(false);
    });

    it("should get active installations", () => {
      orchestrator.registerInstallation(
        "install-1",
        createMockInstallation({ installId: "install-1" }),
      );
      orchestrator.registerInstallation(
        "install-2",
        createMockInstallation({ installId: "install-2" }),
      );

      const active = orchestrator.getActiveInstallations();
      expect(active).toHaveLength(2);
    });
  });

  describe("phase management", () => {
    it("should initialize phase tracking", () => {
      orchestrator.initializePhaseTracking("collection-1");
      expect(orchestrator.hasPhaseTracking("collection-1")).toBe(true);
    });

    it("should return false for non-existent phase tracking", () => {
      expect(orchestrator.hasPhaseTracking("non-existent")).toBe(false);
    });

    it("should cleanup phase tracking", () => {
      orchestrator.initializePhaseTracking("collection-1");
      orchestrator.cleanupPhaseTracking("collection-1");
      expect(orchestrator.hasPhaseTracking("collection-1")).toBe(false);
    });

    it("should check if phase can install", () => {
      orchestrator.initializePhaseTracking("collection-1");

      // Phase 0 should be installable when no allowed phase is set
      expect(orchestrator.canInstallPhase("collection-1", 0)).toBe(true);
    });

    it("should block install when deploying", () => {
      orchestrator.initializePhaseTracking("collection-1");
      const phaseManager = orchestrator.getPhaseManager();
      phaseManager.setDeploying("collection-1", true);

      expect(orchestrator.canInstallPhase("collection-1", 0)).toBe(false);
    });

    it("should allow install for allowed phase", () => {
      orchestrator.initializePhaseTracking("collection-1");
      const phaseManager = orchestrator.getPhaseManager();
      phaseManager.setAllowedPhase("collection-1", 1);

      expect(orchestrator.canInstallPhase("collection-1", 0)).toBe(true);
      expect(orchestrator.canInstallPhase("collection-1", 1)).toBe(true);
    });
  });

  describe("instruction processing", () => {
    it("should validate instructions", () => {
      const instructions = [
        { type: "copy", source: "file.txt", destination: "mods/file.txt" },
      ];

      const result = orchestrator.validateInstructions(instructions as any);
      expect(result).toEqual([]);
    });

    it("should transform instructions", () => {
      const instructions = [
        { type: "copy", source: "a.txt", destination: "a.txt" },
        { type: "mkdir", destination: "newdir" },
      ];

      const groups = orchestrator.transformInstructions(instructions as any);
      expect(groups.copy).toHaveLength(1);
      expect(groups.mkdir).toHaveLength(1);
    });

    it("should detect instruction errors", () => {
      const groups = orchestrator.transformInstructions([]);
      expect(orchestrator.hasInstructionErrors(groups)).toBe(false);
    });
  });

  describe("dependency resolution", () => {
    it("should split dependencies", () => {
      const deps = [
        createMockDependency({ mod: { id: "mod1" } as any }),
        { error: "Not found" },
      ];

      const isModEnabled = jest.fn<(modId: string) => boolean>(() => true);
      const testModMatch = jest.fn<
        (mod: IMod, ref: IModReference) => boolean | string
      >(() => true);

      const result = orchestrator.splitDependencies(
        deps,
        isModEnabled,
        testModMatch,
        "test",
      );

      expect(result.error).toHaveLength(1);
      expect(result.context).toBe("test");
    });

    it("should check if dependency is error", () => {
      expect(orchestrator.isDependencyError({ error: "test" })).toBe(true);
      expect(orchestrator.isDependencyError(createMockDependency())).toBe(
        false,
      );
    });

    it("should check if dependency is valid", () => {
      expect(orchestrator.isDependency(createMockDependency())).toBe(true);
      expect(orchestrator.isDependency({ error: "test" })).toBe(false);
    });
  });

  describe("debug state", () => {
    it("should return debug state", () => {
      orchestrator.registerInstallation("install-1", createMockInstallation());

      const state = orchestrator.debugState();

      expect(state.tracker.activeCount).toBe(1);
      expect(state.config).toEqual(DEFAULT_ORCHESTRATOR_CONFIG);
    });
  });

  describe("cleanup", () => {
    it("should force cleanup stuck installs", () => {
      // Create a mock API
      const mockApi = {
        store: {
          dispatch: jest.fn(),
        },
      } as any;

      // Register an "old" installation - use consistent installId
      const installId = "old-install";
      const oldInstall = createMockInstallation({
        installId,
        startTime: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      });
      orchestrator.registerInstallation(installId, oldInstall);

      const cleanedCount = orchestrator.forceCleanupStuckInstalls(mockApi, 10);

      expect(cleanedCount).toBe(1);
      expect(orchestrator.getActiveInstallationCount()).toBe(0);
    });
  });
});
