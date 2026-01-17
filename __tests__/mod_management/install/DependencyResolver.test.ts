import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  isDependencyError,
  isDependency,
  splitDependencies,
  filterProcessingDependencies,
  groupDependenciesByPhase,
  getPhases,
  countDependencies,
  isPhaseComplete,
  getReadyToInstall,
  getNeedingDownload,
  createProgressTracker,
  summarizeErrors,
  logDependencyResults,
  IDependencyError,
  IDependencySplit,
  DependencyResult,
} from "../../../src/extensions/mod_management/install/DependencyResolver";
import type { IDependency } from "../../../src/extensions/mod_management/types/IDependency";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Helper to create mock dependencies
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

// Helper to create mock dependency errors
function createMockError(
  error: string,
  refName?: string,
): IDependencyError {
  return {
    error,
    reference: refName ? { logicalFileName: refName } : undefined,
  };
}

describe("DependencyResolver", () => {
  describe("isDependencyError", () => {
    it("should return true for error objects", () => {
      const error: IDependencyError = { error: "Not found" };
      expect(isDependencyError(error)).toBe(true);
    });

    it("should return false for dependency objects", () => {
      const dep = createMockDependency();
      expect(isDependencyError(dep)).toBe(false);
    });
  });

  describe("isDependency", () => {
    it("should return true for dependency objects", () => {
      const dep = createMockDependency();
      expect(isDependency(dep)).toBe(true);
    });

    it("should return false for error objects", () => {
      const error: IDependencyError = { error: "Not found" };
      expect(isDependency(error)).toBe(false);
    });
  });

  describe("splitDependencies", () => {
    it("should categorize errors separately", () => {
      const deps: DependencyResult[] = [
        createMockDependency({ mod: { id: "mod1" } as any }),
        createMockError("Not found", "missing-mod"),
      ];

      const isModEnabled = jest.fn(() => true);
      const testModMatch = jest.fn(() => true);

      const result = splitDependencies(deps, isModEnabled, testModMatch);

      expect(result.error).toHaveLength(1);
      expect(result.error[0].error).toBe("Not found");
    });

    it("should categorize existing mods (enabled and matching)", () => {
      const dep = createMockDependency({
        mod: { id: "mod1" } as any,
        reference: { logicalFileName: "test" },
      });

      const isModEnabled = jest.fn(() => true);
      const testModMatch = jest.fn(() => true);

      const result = splitDependencies([dep], isModEnabled, testModMatch);

      expect(result.existing).toHaveLength(1);
      expect(result.success).toHaveLength(0);
    });

    it("should categorize mods that need installation (not enabled)", () => {
      const dep = createMockDependency({
        mod: { id: "mod1" } as any,
        reference: { logicalFileName: "test" },
      });

      const isModEnabled = jest.fn(() => false);
      const testModMatch = jest.fn(() => true);

      const result = splitDependencies([dep], isModEnabled, testModMatch);

      expect(result.success).toHaveLength(1);
      expect(result.existing).toHaveLength(0);
    });

    it("should categorize mods that need installation (no mod yet)", () => {
      const dep = createMockDependency({
        mod: undefined,
        reference: { logicalFileName: "test" },
      });

      const isModEnabled = jest.fn(() => false);
      const testModMatch = jest.fn(() => true);

      const result = splitDependencies([dep], isModEnabled, testModMatch);

      expect(result.success).toHaveLength(1);
    });

    it("should categorize mods that need installation (version mismatch)", () => {
      const dep = createMockDependency({
        mod: { id: "mod1" } as any,
        reference: { logicalFileName: "test", versionMatch: ">=2.0" },
      });

      const isModEnabled = jest.fn(() => true);
      const testModMatch = jest.fn(() => "version mismatch");

      const result = splitDependencies([dep], isModEnabled, testModMatch);

      expect(result.success).toHaveLength(1);
      expect(result.existing).toHaveLength(0);
    });

    it("should handle empty array", () => {
      const result = splitDependencies(
        [],
        jest.fn<(modId: string) => boolean>(),
        jest.fn<(mod: any, reference: any) => boolean | string>(),
      );

      expect(result.success).toHaveLength(0);
      expect(result.existing).toHaveLength(0);
      expect(result.error).toHaveLength(0);
    });
  });

  describe("filterProcessingDependencies", () => {
    it("should filter out dependencies being processed", () => {
      const deps = [
        createMockDependency({ download: "dl1" }),
        createMockDependency({ download: "dl2" }),
        createMockDependency({ download: "dl3" }),
      ];

      const isProcessing = jest.fn((dep: IDependency) => dep.download === "dl2");

      const result = filterProcessingDependencies(deps, isProcessing);

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.download)).toEqual(["dl1", "dl3"]);
    });

    it("should return all if none are processing", () => {
      const deps = [
        createMockDependency({ download: "dl1" }),
        createMockDependency({ download: "dl2" }),
      ];

      const result = filterProcessingDependencies(deps, () => false);

      expect(result).toHaveLength(2);
    });
  });

  describe("groupDependenciesByPhase", () => {
    it("should group dependencies by phase", () => {
      const deps = [
        createMockDependency({ phase: 0 }),
        createMockDependency({ phase: 1 }),
        createMockDependency({ phase: 0 }),
        createMockDependency({ phase: 2 }),
      ];

      const result = groupDependenciesByPhase(deps);

      expect(result.get(0)).toHaveLength(2);
      expect(result.get(1)).toHaveLength(1);
      expect(result.get(2)).toHaveLength(1);
    });

    it("should default undefined phase to 0", () => {
      const deps = [
        createMockDependency({ phase: undefined }),
        createMockDependency({ phase: 1 }),
      ];

      const result = groupDependenciesByPhase(deps);

      expect(result.get(0)).toHaveLength(1);
      expect(result.get(1)).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const result = groupDependenciesByPhase([]);
      expect(result.size).toBe(0);
    });
  });

  describe("getPhases", () => {
    it("should return sorted unique phases", () => {
      const deps = [
        createMockDependency({ phase: 2 }),
        createMockDependency({ phase: 0 }),
        createMockDependency({ phase: 1 }),
        createMockDependency({ phase: 0 }),
      ];

      const result = getPhases(deps);

      expect(result).toEqual([0, 1, 2]);
    });

    it("should handle undefined phases as 0", () => {
      const deps = [
        createMockDependency({ phase: undefined }),
        createMockDependency({ phase: 1 }),
      ];

      const result = getPhases(deps);

      expect(result).toEqual([0, 1]);
    });

    it("should return empty array for empty input", () => {
      expect(getPhases([])).toEqual([]);
    });
  });

  describe("countDependencies", () => {
    it("should count all categories", () => {
      const split: IDependencySplit = {
        success: [createMockDependency(), createMockDependency()],
        existing: [createMockDependency()],
        error: [createMockError("err1"), createMockError("err2")],
      };

      const counts = countDependencies(split);

      expect(counts.total).toBe(5);
      expect(counts.success).toBe(2);
      expect(counts.existing).toBe(1);
      expect(counts.error).toBe(2);
    });

    it("should handle empty split", () => {
      const split: IDependencySplit = {
        success: [],
        existing: [],
        error: [],
      };

      const counts = countDependencies(split);

      expect(counts.total).toBe(0);
    });
  });

  describe("isPhaseComplete", () => {
    it("should return true when all dependencies are installed", () => {
      const deps = [
        createMockDependency({ mod: { id: "m1" } as any }),
        createMockDependency({ mod: { id: "m2" } as any }),
      ];

      const isInstalled = jest.fn(() => true);

      expect(isPhaseComplete(deps, isInstalled)).toBe(true);
    });

    it("should return false when some dependencies are not installed", () => {
      const deps = [
        createMockDependency({ mod: { id: "m1" } as any }),
        createMockDependency({ mod: undefined }),
      ];

      const isInstalled = jest.fn((dep: IDependency) => dep.mod !== undefined);

      expect(isPhaseComplete(deps, isInstalled)).toBe(false);
    });

    it("should return true for empty phase", () => {
      expect(isPhaseComplete([], jest.fn<(dep: IDependency) => boolean>())).toBe(true);
    });
  });

  describe("getReadyToInstall", () => {
    it("should return dependencies with downloads", () => {
      const deps = [
        createMockDependency({ download: "dl1" }),
        createMockDependency({ download: undefined }),
        createMockDependency({ download: "dl2" }),
      ];

      const hasDownload = jest.fn((dep: IDependency) => dep.download !== undefined);

      const result = getReadyToInstall(deps, hasDownload);

      expect(result).toHaveLength(2);
    });
  });

  describe("getNeedingDownload", () => {
    it("should return dependencies without downloads", () => {
      const deps = [
        createMockDependency({ download: "dl1" }),
        createMockDependency({ download: undefined }),
        createMockDependency({ download: "dl2" }),
      ];

      const hasDownload = jest.fn((dep: IDependency) => dep.download !== undefined);

      const result = getNeedingDownload(deps, hasDownload);

      expect(result).toHaveLength(1);
      expect(result[0].download).toBeUndefined();
    });
  });

  describe("createProgressTracker", () => {
    it("should call progress callback with correct percentages", () => {
      const onProgress = jest.fn();
      const trackProgress = createProgressTracker(4, onProgress);

      trackProgress();
      expect(onProgress).toHaveBeenLastCalledWith(0.25);

      trackProgress();
      expect(onProgress).toHaveBeenLastCalledWith(0.5);

      trackProgress();
      expect(onProgress).toHaveBeenLastCalledWith(0.75);

      trackProgress();
      expect(onProgress).toHaveBeenLastCalledWith(1);
    });

    it("should handle zero total gracefully", () => {
      const onProgress = jest.fn();
      const trackProgress = createProgressTracker(0, onProgress);

      trackProgress();
      expect(onProgress).not.toHaveBeenCalled();
    });

    it("should work without callback", () => {
      const trackProgress = createProgressTracker(5);
      expect(() => trackProgress()).not.toThrow();
    });
  });

  describe("summarizeErrors", () => {
    it("should format error summary", () => {
      const errors = [
        createMockError("Not found", "mod-a"),
        createMockError("Version mismatch", "mod-b"),
      ];

      const result = summarizeErrors(errors);

      expect(result).toContain("mod-a: Not found");
      expect(result).toContain("mod-b: Version mismatch");
    });

    it("should handle errors without reference", () => {
      const errors = [{ error: "Unknown error" }];

      const result = summarizeErrors(errors);

      expect(result).toContain("Unknown: Unknown error");
    });

    it("should return empty string for no errors", () => {
      expect(summarizeErrors([])).toBe("");
    });
  });

  describe("logDependencyResults", () => {
    it("should log results without throwing", () => {
      const split: IDependencySplit = {
        success: [createMockDependency()],
        existing: [createMockDependency()],
        error: [createMockError("err", "mod")],
      };

      expect(() => logDependencyResults(split, "test")).not.toThrow();
    });

    it("should handle empty split", () => {
      const split: IDependencySplit = {
        success: [],
        existing: [],
        error: [],
      };

      expect(() => logDependencyResults(split, "test")).not.toThrow();
    });
  });
});
