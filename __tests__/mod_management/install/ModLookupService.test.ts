import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  hasFuzzyReference,
  checkModVariantsExist,
  checkModNameExists,
  findPreviousVersionMod,
  findDownloadForMod,
  ModLookupService,
} from "../../../src/extensions/mod_management/install/ModLookupService";
import type { IModReference } from "../../../src/extensions/mod_management/types/IMod";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock dependencies
jest.mock("../../../src/extensions/mod_management/util/dependencies", () => ({
  findDownloadByRef: jest.fn(() => null),
}));

jest.mock("../../../src/extensions/mod_management/util/testModReference", () => ({
  testRefByIdentifiers: jest.fn(() => false),
}));

describe("ModLookupService", () => {
  describe("hasFuzzyReference", () => {
    it("should return true when fileExpression is defined", () => {
      const ref: Partial<IModReference> = {
        fileExpression: "*.dll",
      };
      expect(hasFuzzyReference(ref as IModReference)).toBe(true);
    });

    it("should return true when fileMD5 is defined", () => {
      const ref: Partial<IModReference> = {
        fileMD5: "abc123",
      };
      expect(hasFuzzyReference(ref as IModReference)).toBe(true);
    });

    it("should return true when logicalFileName is defined", () => {
      const ref: Partial<IModReference> = {
        logicalFileName: "test.esp",
      };
      expect(hasFuzzyReference(ref as IModReference)).toBe(true);
    });

    it("should return false when no fuzzy fields are defined", () => {
      const ref: Partial<IModReference> = {
        id: "test-mod",
      };
      expect(hasFuzzyReference(ref as IModReference)).toBe(false);
    });
  });

  describe("checkModVariantsExist", () => {
    it("should return empty array for null archiveId", () => {
      const mockApi = {
        getState: jest.fn(() => ({
          persistent: { mods: { skyrimse: {} } },
        })),
      };

      const result = checkModVariantsExist(
        mockApi as any,
        "skyrimse",
        null as any,
      );
      expect(result).toEqual([]);
    });

    it("should return matching mod IDs", () => {
      const mockApi = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {
                "mod1": { id: "mod1", archiveId: "archive-123" },
                "mod2": { id: "mod2", archiveId: "archive-123" },
                "mod3": { id: "mod3", archiveId: "archive-456" },
              },
            },
          },
        })),
      };

      const result = checkModVariantsExist(
        mockApi as any,
        "skyrimse",
        "archive-123",
      );
      expect(result).toContain("mod1");
      expect(result).toContain("mod2");
      expect(result).not.toContain("mod3");
    });
  });

  describe("checkModNameExists", () => {
    it("should return matching mod IDs", () => {
      const mockApi = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {
                "test-mod": { id: "test-mod" },
                "other-mod": { id: "other-mod" },
              },
            },
          },
        })),
      };

      const result = checkModNameExists("test-mod", mockApi as any, "skyrimse");
      expect(result).toEqual(["test-mod"]);
    });

    it("should return empty array when mod does not exist", () => {
      const mockApi = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {},
            },
          },
        })),
      };

      const result = checkModNameExists("non-existent", mockApi as any, "skyrimse");
      expect(result).toEqual([]);
    });
  });

  describe("findPreviousVersionMod", () => {
    it("should find mod with matching newestFileId", () => {
      const mockStore = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {
                "mod1": {
                  id: "mod1",
                  type: "mod",
                  attributes: { newestFileId: 1000, fileId: 999 },
                },
              },
            },
          },
        })),
      };

      const result = findPreviousVersionMod(
        1000,
        mockStore as any,
        "skyrimse",
        false,
      );
      expect(result?.id).toBe("mod1");
    });

    it("should return undefined when no matching mod", () => {
      const mockStore = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {
                "mod1": {
                  id: "mod1",
                  type: "mod",
                  attributes: { newestFileId: 999, fileId: 999 },
                },
              },
            },
          },
        })),
      };

      const result = findPreviousVersionMod(
        1000,
        mockStore as any,
        "skyrimse",
        false,
      );
      expect(result).toBeUndefined();
    });

    it("should filter by collection type when isCollection is true", () => {
      const mockStore = {
        getState: jest.fn(() => ({
          persistent: {
            mods: {
              skyrimse: {
                "mod1": {
                  id: "mod1",
                  type: "mod",
                  attributes: { newestFileId: 1000, fileId: 999 },
                },
                "collection1": {
                  id: "collection1",
                  type: "collection",
                  attributes: { newestFileId: 1000, revisionId: 999 },
                },
              },
            },
          },
        })),
      };

      const result = findPreviousVersionMod(
        1000,
        mockStore as any,
        "skyrimse",
        true,
      );
      expect(result?.id).toBe("collection1");
    });
  });

  describe("findDownloadForMod", () => {
    it("should return null when no downloads match", () => {
      const ref: Partial<IModReference> = {
        gameId: "skyrimse",
      };
      const downloads = {};

      const result = findDownloadForMod(ref as IModReference, downloads);
      expect(result).toBeNull();
    });
  });

  describe("ModLookupService class", () => {
    let service: ModLookupService;

    beforeEach(() => {
      service = new ModLookupService();
    });

    it("should provide hasFuzzyReference method", () => {
      const ref: Partial<IModReference> = {
        fileExpression: "*.dll",
      };
      expect(service.hasFuzzyReference(ref as IModReference)).toBe(true);
    });

    it("should provide checkModVariantsExist method", () => {
      const mockApi = {
        getState: jest.fn(() => ({
          persistent: { mods: { skyrimse: {} } },
        })),
      };
      const result = service.checkModVariantsExist(
        mockApi as any,
        "skyrimse",
        null as any,
      );
      expect(result).toEqual([]);
    });
  });
});
