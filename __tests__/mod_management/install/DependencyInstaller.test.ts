import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import Bluebird from "bluebird";
import {
  showMemoDialog,
  installRecommendationsQueryMain,
  installRecommendationsQuerySelect,
  updateModRule,
  updateRules,
  DependencyInstaller,
} from "../../../src/extensions/mod_management/install/DependencyInstaller";
import type { IDependency } from "../../../src/extensions/mod_management/types/IDependency";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock modName utility
jest.mock("../../../src/extensions/mod_management/util/modName", () => ({
  __esModule: true,
  default: jest.fn((mod: any) => mod?.attributes?.name || mod?.id || "Unknown"),
  renderModReference: jest.fn(
    (ref: any) => ref?.logicalFileName || ref?.id || "Unknown Mod",
  ),
}));

// Mock testModReference
jest.mock(
  "../../../src/extensions/mod_management/util/testModReference",
  () => ({
    referenceEqual: jest.fn(
      (a: any, b: any) =>
        a?.id === b?.id || a?.logicalFileName === b?.logicalFileName,
    ),
  }),
);

// Mock actions
jest.mock("../../../src/extensions/mod_management/actions/mods", () => ({
  addModRule: jest.fn((gameId, modId, rule) => ({
    type: "ADD_MOD_RULE",
    payload: { gameId, modId, rule },
  })),
  removeModRule: jest.fn((gameId, modId, rule) => ({
    type: "REMOVE_MOD_RULE",
    payload: { gameId, modId, rule },
  })),
}));

// Mock showDialog action
jest.mock("../../../src/actions/notifications", () => ({
  showDialog: jest.fn((...args) => ({
    type: "SHOW_DIALOG",
    payload: args,
  })),
}));

// Helper to create mock dependency
function createMockDependency(overrides: Partial<IDependency> = {}): any {
  return {
    reference: {
      id: "test-dep",
      logicalFileName: "test-dep.esp",
    },
    lookupResults: [{ value: { fileName: "Test Dependency" } }],
    download: undefined,
    mod: undefined,
    ...overrides,
  };
}

// Helper to create mock API
function createMockApi(stateOverrides: any = {}) {
  const state = {
    persistent: {
      downloads: { files: {} },
      mods: {
        skyrimse: {
          "source-mod": {
            id: "source-mod",
            rules: [
              {
                type: "requires",
                reference: { id: "test-dep", logicalFileName: "test-dep.esp" },
              },
            ],
          },
        },
      },
    },
    ...stateOverrides,
  };

  return {
    getState: jest.fn(() => state),
    translate: jest.fn((text: string, opts?: any) => {
      if (opts?.replace) {
        let result = text;
        Object.entries(opts.replace).forEach(([key, value]) => {
          result = result.replace(`{{${key}}}`, String(value));
        });
        return result;
      }
      return text;
    }),
    store: {
      getState: jest.fn(() => state),
      dispatch: jest.fn((action: any) => {
        if (action?.type === "SHOW_DIALOG") {
          return Promise.resolve({ action: "Install", input: {} });
        }
        return action;
      }),
    },
  } as any;
}

// Helper to create mock batch context
function createMockContext(remember: boolean | null = null) {
  const storage = new Map<string, any>();
  if (remember !== null) {
    storage.set("remember", remember);
  }
  return {
    get: jest.fn((key: string, defaultVal: any) =>
      storage.has(key) ? storage.get(key) : defaultVal,
    ),
    set: jest.fn((key: string, value: any) => storage.set(key, value)),
  } as any;
}

describe("DependencyInstaller", () => {
  describe("showMemoDialog", () => {
    it("should return cached Install action when remember is true", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockContext(true);

      const result = await showMemoDialog(
        mockApi,
        mockContext,
        "Test Mod",
        [createMockDependency()],
        [],
      );

      expect(result.action).toBe("Install");
      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
    });

    it("should show dialog when remember is false (truthy check fails for false)", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockContext(false);

      await showMemoDialog(
        mockApi,
        mockContext,
        "Test Mod",
        [createMockDependency()],
        [],
      );

      // When remember is false, truthy(false) returns false, so dialog is shown
      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });

    it("should dispatch dialog when remember is null", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockContext(null);

      await showMemoDialog(
        mockApi,
        mockContext,
        "Test Mod",
        [createMockDependency()],
        [],
      );

      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });
  });

  describe("installRecommendationsQueryMain", () => {
    it("should return Install All when remember is true", async () => {
      const mockApi = createMockApi();

      const result = await installRecommendationsQueryMain(
        mockApi,
        "Test Mod",
        [createMockDependency()],
        [],
        true,
      );

      expect(result.action).toBe("Install All");
    });

    it("should return Skip when remember is false", async () => {
      const mockApi = createMockApi();

      const result = await installRecommendationsQueryMain(
        mockApi,
        "Test Mod",
        [createMockDependency()],
        [],
        false,
      );

      expect(result.action).toBe("Skip");
    });

    it("should dispatch dialog when remember is null", async () => {
      const mockApi = createMockApi();

      await installRecommendationsQueryMain(
        mockApi,
        "Test Mod",
        [createMockDependency()],
        [],
        null,
      );

      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });
  });

  describe("installRecommendationsQuerySelect", () => {
    it("should dispatch selection dialog", async () => {
      const mockApi = createMockApi();

      await installRecommendationsQuerySelect(mockApi, "Test Mod", [
        createMockDependency(),
      ]);

      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });
  });

  describe("updateModRule", () => {
    it("should return undefined when no matching rule found", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency({
        reference: { id: "non-existent", logicalFileName: "non-existent.esp" },
      });

      const result = updateModRule(
        mockApi,
        "skyrimse",
        "source-mod",
        dep,
        dep.reference,
        false,
      );

      expect(result).toBeUndefined();
    });

    it("should dispatch removeModRule and addModRule when rule exists", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency();

      updateModRule(
        mockApi,
        "skyrimse",
        "source-mod",
        dep,
        { ...dep.reference, idHint: "installed-mod" },
        false,
      );

      // Should have dispatched both remove and add
      expect(mockApi.store.dispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateRules", () => {
    it("should process all dependencies", async () => {
      const mockApi = createMockApi();
      const deps = [
        createMockDependency({ mod: { id: "mod1" } as any }),
        createMockDependency({
          reference: { id: "dep2", logicalFileName: "dep2.esp" },
          mod: { id: "mod2" } as any,
        }),
      ];

      await updateRules(mockApi, "skyrimse", "source-mod", deps, false);

      // updateModRule is called for each dependency
      // Each matching rule triggers 2 dispatches (remove + add)
      // First dep matches, second doesn't
      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });

    it("should return resolved promise", async () => {
      const mockApi = createMockApi();

      const result = updateRules(mockApi, "skyrimse", "source-mod", [], false);

      await expect(result).resolves.toBeUndefined();
    });
  });

  describe("DependencyInstaller class", () => {
    let installer: DependencyInstaller;
    let mockApi: any;

    beforeEach(() => {
      mockApi = createMockApi();
      installer = new DependencyInstaller(mockApi);
    });

    it("should provide showMemoDialog method", async () => {
      const mockContext = createMockContext(true);

      const result = await installer.showMemoDialog(
        mockContext,
        "Test Mod",
        [],
        [],
      );

      expect(result.action).toBe("Install");
    });

    it("should provide installRecommendationsQueryMain method", async () => {
      const result = await installer.installRecommendationsQueryMain(
        "Test Mod",
        [],
        [],
        true,
      );

      expect(result.action).toBe("Install All");
    });

    it("should provide installRecommendationsQuerySelect method", async () => {
      await installer.installRecommendationsQuerySelect("Test Mod", []);

      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });

    it("should provide updateModRule method", () => {
      const dep = createMockDependency();

      const result = installer.updateModRule(
        "skyrimse",
        "source-mod",
        dep,
        dep.reference,
        false,
      );

      // Rule exists, so should return updated rule
      expect(result).toBeDefined();
    });

    it("should provide updateRules method", async () => {
      const result = installer.updateRules(
        "skyrimse",
        "source-mod",
        [],
        false,
      );

      await expect(result).resolves.toBeUndefined();
    });
  });
});
