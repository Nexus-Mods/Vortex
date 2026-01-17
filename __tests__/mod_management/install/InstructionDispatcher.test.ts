import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import Bluebird from "bluebird";
import {
  processAttribute,
  processEnableAllPlugins,
  processSetModType,
  processRule,
  InstructionDispatcher,
} from "../../../src/extensions/mod_management/install/InstructionDispatcher";
import type { IInstruction } from "../../../src/extensions/mod_management/types/IInstallResult";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock batchDispatch
jest.mock("../../../src/util/util", () => ({
  batchDispatch: jest.fn(),
}));

// Mock actions
jest.mock("../../../src/extensions/mod_management/actions/mods", () => ({
  setModAttribute: jest.fn(
    (gameId: string, modId: string, key: string, value: any) => ({
      type: "SET_MOD_ATTRIBUTE",
      payload: { gameId, modId, key, value },
    }),
  ),
  setModType: jest.fn((gameId: string, modId: string, type: string) => ({
    type: "SET_MOD_TYPE",
    payload: { gameId, modId, type },
  })),
  addModRule: jest.fn((gameId: string, modId: string, rule: any) => ({
    type: "ADD_MOD_RULE",
    payload: { gameId, modId, rule },
  })),
}));

import { log } from "../../../src/util/log";
import { batchDispatch } from "../../../src/util/util";
import {
  setModAttribute,
  setModType,
  addModRule,
} from "../../../src/extensions/mod_management/actions/mods";

// Helper to create mock API
function createMockApi() {
  return {
    store: {
      dispatch: jest.fn(),
    },
  } as any;
}

// Helper to create mock install context
function createMockInstallContext() {
  return {
    setModType: jest.fn(),
  } as any;
}

describe("InstructionDispatcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processAttribute", () => {
    it("should dispatch setModAttribute for each attribute", async () => {
      const mockApi = createMockApi();
      const attributes: IInstruction[] = [
        { type: "attribute", key: "author", value: "TestAuthor" },
        { type: "attribute", key: "version", value: "1.0.0" },
      ];

      const result = processAttribute(mockApi, attributes, "skyrimse", "mod-1");

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockApi.store.dispatch).toHaveBeenCalledTimes(2);
      expect(setModAttribute).toHaveBeenCalledWith(
        "skyrimse",
        "mod-1",
        "author",
        "TestAuthor",
      );
      expect(setModAttribute).toHaveBeenCalledWith(
        "skyrimse",
        "mod-1",
        "version",
        "1.0.0",
      );
    });

    it("should handle empty attributes array", async () => {
      const mockApi = createMockApi();
      const attributes: IInstruction[] = [];

      const result = processAttribute(mockApi, attributes, "skyrimse", "mod-1");

      await result;
      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("processEnableAllPlugins", () => {
    it("should dispatch setModAttribute with enableallplugins=true when array is non-empty", async () => {
      const mockApi = createMockApi();
      // Note: "enableallplugins" is not a valid InstructionType, but the function only checks length
      const enableAll: IInstruction[] = [{ type: "attribute" }];

      const result = processEnableAllPlugins(
        mockApi,
        enableAll,
        "skyrimse",
        "mod-1",
      );

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockApi.store.dispatch).toHaveBeenCalledTimes(1);
      expect(setModAttribute).toHaveBeenCalledWith(
        "skyrimse",
        "mod-1",
        "enableallplugins",
        true,
      );
    });

    it("should not dispatch when array is empty", async () => {
      const mockApi = createMockApi();
      const enableAll: IInstruction[] = [];

      const result = processEnableAllPlugins(
        mockApi,
        enableAll,
        "skyrimse",
        "mod-1",
      );

      await result;
      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("processSetModType", () => {
    it("should set mod type from last instruction", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockInstallContext();
      const types: IInstruction[] = [{ type: "setmodtype", value: "custom-type" }];

      const result = processSetModType(
        mockApi,
        mockContext,
        types,
        "skyrimse",
        "mod-1",
      );

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockContext.setModType).toHaveBeenCalledWith("mod-1", "custom-type");
      expect(mockApi.store.dispatch).toHaveBeenCalledTimes(1);
      expect(setModType).toHaveBeenCalledWith("skyrimse", "mod-1", "custom-type");
    });

    it("should use last type when multiple types provided", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockInstallContext();
      const types: IInstruction[] = [
        { type: "setmodtype", value: "first-type" },
        { type: "setmodtype", value: "second-type" },
        { type: "setmodtype", value: "last-type" },
      ];

      const result = processSetModType(
        mockApi,
        mockContext,
        types,
        "skyrimse",
        "mod-1",
      );

      await result;
      expect(mockContext.setModType).toHaveBeenCalledWith("mod-1", "last-type");
      expect(setModType).toHaveBeenCalledWith("skyrimse", "mod-1", "last-type");
      expect(log).toHaveBeenCalledWith(
        "error",
        "got more than one mod type, only the last was used",
        { types },
      );
    });

    it("should not dispatch when array is empty", async () => {
      const mockApi = createMockApi();
      const mockContext = createMockInstallContext();
      const types: IInstruction[] = [];

      const result = processSetModType(
        mockApi,
        mockContext,
        types,
        "skyrimse",
        "mod-1",
      );

      await result;
      expect(mockContext.setModType).not.toHaveBeenCalled();
      expect(mockApi.store.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("processRule", () => {
    it("should batch dispatch addModRule for each rule", () => {
      const mockApi = createMockApi();
      const rules: IInstruction[] = [
        { type: "rule", rule: { type: "requires", reference: { fileExpression: "file1.esp" } } as any },
        { type: "rule", rule: { type: "conflicts", reference: { fileExpression: "file2.esp" } } as any },
      ];

      processRule(mockApi, rules, "skyrimse", "mod-1");

      expect(addModRule).toHaveBeenCalledTimes(2);
      expect(addModRule).toHaveBeenCalledWith("skyrimse", "mod-1", rules[0].rule);
      expect(addModRule).toHaveBeenCalledWith("skyrimse", "mod-1", rules[1].rule);
      expect(batchDispatch).toHaveBeenCalledWith(mockApi.store, expect.any(Array));
    });

    it("should handle empty rules array", () => {
      const mockApi = createMockApi();
      const rules: IInstruction[] = [];

      processRule(mockApi, rules, "skyrimse", "mod-1");

      expect(batchDispatch).toHaveBeenCalledWith(mockApi.store, []);
    });
  });

  describe("InstructionDispatcher class", () => {
    let dispatcher: InstructionDispatcher;
    let mockApi: any;

    beforeEach(() => {
      mockApi = createMockApi();
      dispatcher = new InstructionDispatcher(mockApi);
    });

    it("should provide processAttribute method", async () => {
      const attributes: IInstruction[] = [{ type: "attribute", key: "name", value: "Test" }];

      const result = dispatcher.processAttribute(attributes, "skyrimse", "mod-1");

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });

    it("should provide processEnableAllPlugins method", async () => {
      const enableAll: IInstruction[] = [{ type: "attribute" }];

      const result = dispatcher.processEnableAllPlugins(
        enableAll,
        "skyrimse",
        "mod-1",
      );

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });

    it("should provide processSetModType method", async () => {
      const mockContext = createMockInstallContext();
      const types: IInstruction[] = [{ type: "setmodtype", value: "custom" }];

      const result = dispatcher.processSetModType(
        mockContext,
        types,
        "skyrimse",
        "mod-1",
      );

      expect(result).toBeInstanceOf(Bluebird);
      await result;
      expect(mockContext.setModType).toHaveBeenCalled();
    });

    it("should provide processRule method", () => {
      const rules: IInstruction[] = [
        { type: "rule", rule: { type: "requires", reference: {} } as any },
      ];

      dispatcher.processRule(rules, "skyrimse", "mod-1");

      expect(batchDispatch).toHaveBeenCalled();
    });
  });
});
