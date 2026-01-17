import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  applyExtraFromRule,
  dropUnfulfilled,
} from "../../../src/extensions/mod_management/install/DependencyPhaseHelpers";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock mod actions
jest.mock("../../../src/extensions/mod_management/actions/mods", () => ({
  setModType: jest.fn((gameId, modId, type) => ({
    type: "SET_MOD_TYPE",
    payload: { gameId, modId, modType: type },
  })),
  setModAttributes: jest.fn((gameId, modId, attributes) => ({
    type: "SET_MOD_ATTRIBUTES",
    payload: { gameId, modId, attributes },
  })),
  addModRule: jest.fn((gameId, modId, rule) => ({
    type: "ADD_MOD_RULE",
    payload: { gameId, modId, rule },
  })),
}));

// Mock category resolution
jest.mock(
  "../../../src/extensions/category_management/util/retrieveCategoryPath",
  () => ({
    resolveCategoryId: jest.fn((category: string, state: any) => {
      if (category === "valid-category") {
        return "category-123";
      }
      return undefined;
    }),
  }),
);

// Mock modName utilities
jest.mock(
  "../../../src/extensions/mod_management/util/modName",
  () => ({
    __esModule: true,
    default: jest.fn((mod: any) => mod?.name || "Unknown Mod"),
    renderModReference: jest.fn((ref: any) => ref?.logicalFileName || "Unknown Ref"),
  }),
);

// Helper to create mock API
function createMockApi(stateOverrides: any = {}) {
  const state = {
    persistent: {
      mods: {
        skyrimse: {
          "source-mod-123": {
            id: "source-mod-123",
            name: "Source Mod",
          },
        },
      },
    },
    ...stateOverrides,
  };

  return {
    getState: jest.fn(() => state),
    store: {
      dispatch: jest.fn(),
    },
    sendNotification: jest.fn(),
    showDialog: jest.fn(),
  } as any;
}

// Helper to create mock dependency
function createMockDependency(overrides: any = {}) {
  return {
    reference: {
      id: "dep-1",
      logicalFileName: "dependency.esp",
    },
    lookupResults: [],
    extra: {},
    fileList: [],
    installerChoices: {},
    ...overrides,
  };
}

describe("DependencyPhaseHelpers", () => {
  describe("applyExtraFromRule", () => {
    it("should do nothing when extra is undefined", () => {
      const mockApi = createMockApi();

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", undefined);

      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
    });

    it("should set mod type when extra.type is defined", () => {
      const mockApi = createMockApi();
      const extra = { type: "dinput" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_TYPE",
        payload: { gameId: "skyrimse", modId: "mod-123", modType: "dinput" },
      });
    });

    it("should set customFileName when extra.name is defined", () => {
      const mockApi = createMockApi();
      const extra = { name: "Custom Name" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { customFileName: "Custom Name" },
        },
      });
    });

    it("should set source and url when extra.url is defined", () => {
      const mockApi = createMockApi();
      const extra = { url: "https://example.com/mod" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { source: "website", url: "https://example.com/mod" },
        },
      });
    });

    it("should set category when extra.category resolves to a valid id", () => {
      const mockApi = createMockApi();
      const extra = { category: "valid-category" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { category: "category-123" },
        },
      });
    });

    it("should not set category when extra.category does not resolve", () => {
      const mockApi = createMockApi();
      const extra = { category: "invalid-category" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: {},
        },
      });
    });

    it("should set author when extra.author is defined", () => {
      const mockApi = createMockApi();
      const extra = { author: "Test Author" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { author: "Test Author" },
        },
      });
    });

    it("should set version when extra.version is defined", () => {
      const mockApi = createMockApi();
      const extra = { version: "1.0.0" };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { version: "1.0.0" },
        },
      });
    });

    it("should set patches when extra.patches is defined", () => {
      const mockApi = createMockApi();
      const extra = { patches: [{ file: "test.esp", patch: "data" }] };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { patches: [{ file: "test.esp", patch: "data" }] },
        },
      });
    });

    it("should set fileList when extra.fileList is defined", () => {
      const mockApi = createMockApi();
      const extra = { fileList: ["file1.esp", "file2.esp"] };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { fileList: ["file1.esp", "file2.esp"] },
        },
      });
    });

    it("should set installerChoices when extra.installerChoices is defined", () => {
      const mockApi = createMockApi();
      const extra = { installerChoices: { step1: "option1" } };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: { installerChoices: { step1: "option1" } },
        },
      });
    });

    it("should handle multiple extra fields at once", () => {
      const mockApi = createMockApi();
      const extra = {
        type: "dinput",
        name: "Custom Name",
        author: "Test Author",
        version: "2.0.0",
      };

      applyExtraFromRule(mockApi, "skyrimse", "mod-123", extra);

      // Should have called dispatch twice: once for type, once for attributes
      expect(mockApi.store.dispatch).toHaveBeenCalledTimes(2);
      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_TYPE",
        payload: { gameId: "skyrimse", modId: "mod-123", modType: "dinput" },
      });
      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "SET_MOD_ATTRIBUTES",
        payload: {
          gameId: "skyrimse",
          modId: "mod-123",
          attributes: {
            customFileName: "Custom Name",
            author: "Test Author",
            version: "2.0.0",
          },
        },
      });
    });
  });

  describe("dropUnfulfilled", () => {
    it("should do nothing when recommended is true", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency();

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", true);

      // Should not dispatch anything for recommended dependencies
      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
      expect(mockApi.sendNotification).not.toHaveBeenCalled();
    });

    it("should add ignored rule and send notification when not recommended", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency();

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", false);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "ADD_MOD_RULE",
        payload: {
          gameId: "skyrimse",
          modId: "source-mod-123",
          rule: expect.objectContaining({
            type: "requires",
            ignored: true,
          }),
        },
      });

      expect(mockApi.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Unfulfillable rule dropped",
          group: "unfulfillable-rule-dropped",
        }),
      );
    });

    it("should include reference in the notification message", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency({
        reference: { logicalFileName: "special-dependency.esp" },
      });

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", false);

      expect(mockApi.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "special-dependency.esp",
        }),
      );
    });

    it("should include More action in notification", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency();

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", false);

      const notificationCall = mockApi.sendNotification.mock.calls[0][0];
      expect(notificationCall.actions).toHaveLength(1);
      expect(notificationCall.actions[0].title).toBe("More");
      expect(typeof notificationCall.actions[0].action).toBe("function");
    });

    it("should show dialog when More action is clicked", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency();

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", false);

      // Get the More action and call it
      const notificationCall = mockApi.sendNotification.mock.calls[0][0];
      const moreAction = notificationCall.actions[0].action;
      moreAction();

      expect(mockApi.showDialog).toHaveBeenCalledWith(
        "info",
        "Unfulfillable rule disabled",
        expect.objectContaining({
          text: expect.stringContaining("Vortex is not able to fulfill automatically"),
        }),
        [{ label: "Close" }],
      );
    });

    it("should pick correct fields from dependency for rule", () => {
      const mockApi = createMockApi();
      const dep = createMockDependency({
        reference: { id: "ref-id", logicalFileName: "test.esp" },
        extra: { phase: 0 },
        fileList: ["file1.esp"],
        installerChoices: { step: "choice" },
      });

      dropUnfulfilled(mockApi, dep, "skyrimse", "source-mod-123", false);

      expect(mockApi.store.dispatch).toHaveBeenCalledWith({
        type: "ADD_MOD_RULE",
        payload: {
          gameId: "skyrimse",
          modId: "source-mod-123",
          rule: expect.objectContaining({
            reference: { id: "ref-id", logicalFileName: "test.esp" },
            extra: { phase: 0 },
            fileList: ["file1.esp"],
            installerChoices: { step: "choice" },
            ignored: true,
          }),
        },
      });
    });
  });
});
