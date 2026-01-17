import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  validateVariantName,
  INSTALL_ACTION,
  REPLACE_ACTION,
} from "../../../src/extensions/mod_management/install/UserDialogManager";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

describe("UserDialogManager", () => {
  describe("validateVariantName", () => {
    const mockTranslate = jest.fn((text: string, opts?: any) => {
      if (opts?.replace) {
        let result = text;
        Object.entries(opts.replace).forEach(([key, value]) => {
          result = result.replace(`{{${key}}}`, String(value));
        });
        return result;
      }
      return text;
    });

    beforeEach(() => {
      mockTranslate.mockClear();
    });

    it("should return empty array for valid variant name", () => {
      const content = {
        input: [{ id: "variant", value: "variant1" }],
      };

      const result = validateVariantName(mockTranslate as any, content as any);
      expect(result).toEqual([]);
    });

    it("should return error for variant name that is too short", () => {
      const content = {
        input: [{ id: "variant", value: "" }],
      };

      const result = validateVariantName(mockTranslate as any, content as any);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("variant");
      expect(result[0].actions).toContain("Continue");
    });

    it("should return error for variant name that is too long", () => {
      const content = {
        input: [{ id: "variant", value: "a".repeat(65) }],
      };

      const result = validateVariantName(mockTranslate as any, content as any);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("variant");
    });

    it("should handle missing input gracefully", () => {
      const content = {
        input: [],
      };

      const result = validateVariantName(mockTranslate as any, content as any);
      // Empty string is too short
      expect(result).toHaveLength(1);
    });
  });

  describe("constants", () => {
    it("should export INSTALL_ACTION constant", () => {
      expect(INSTALL_ACTION).toBe("Update current profile");
    });

    it("should export REPLACE_ACTION constant", () => {
      expect(REPLACE_ACTION).toBe("Update all profiles");
    });
  });
});
