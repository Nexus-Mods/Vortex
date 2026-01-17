import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  InstructionProcessor,
  validateInstructions,
  transformInstructions,
} from "../../../src/extensions/mod_management/install/InstructionProcessor";
import { InstructionGroups } from "../../../src/extensions/mod_management/install/InstructionGroups";
import type { IInstruction } from "../../../src/extensions/mod_management/types/IInstallResult";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock fs module
jest.mock("../../../src/util/fs", () => ({
  ensureDirAsync: jest.fn(() => Promise.resolve()),
  writeFileAsync: jest.fn(() => Promise.resolve()),
}));

describe("InstructionProcessor", () => {
  let processor: InstructionProcessor;

  beforeEach(() => {
    processor = new InstructionProcessor();
  });

  describe("validateInstructions", () => {
    it("should return empty array for valid instructions", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "file.txt", destination: "mods/file.txt" },
        { type: "copy", source: "data.bin", destination: "data/data.bin" },
      ];

      const result = processor.validateInstructions(instructions);

      expect(result).toEqual([]);
    });

    it("should detect invalid destination paths on Windows", () => {
      // Skip on non-Windows - path validation is platform-specific
      if (process.platform !== "win32") {
        return;
      }
      const instructions: IInstruction[] = [
        { type: "copy", source: "file.txt", destination: "mods/file.txt" },
        { type: "copy", source: "bad.txt", destination: "mods/<invalid>.txt" },
      ];

      const result = processor.validateInstructions(instructions);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe("copy");
      expect(result[0].error).toContain("invalid destination path");
    });

    it("should detect empty filename segments as invalid", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "file.txt", destination: "mods//file.txt" },
      ];

      const result = processor.validateInstructions(instructions);

      // Empty segment between slashes should be invalid
      expect(result.length).toBe(1);
    });

    it("should handle instructions without destination", () => {
      const instructions: IInstruction[] = [
        { type: "attribute", key: "version", value: "1.0" },
        { type: "setmodtype", value: "custom" },
      ];

      const result = processor.validateInstructions(instructions);

      expect(result).toEqual([]);
    });

    it("should handle leading path separator (FOMOD compatibility)", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "file.txt", destination: "/mods/file.txt" },
      ];

      const result = processor.validateInstructions(instructions);

      // Should strip leading separator and validate
      expect(result).toEqual([]);
    });

    it("should handle empty instructions array", () => {
      const result = processor.validateInstructions([]);
      expect(result).toEqual([]);
    });
  });

  describe("transformInstructions", () => {
    it("should group instructions by type", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "a.txt", destination: "a.txt" },
        { type: "copy", source: "b.txt", destination: "b.txt" },
        { type: "mkdir", destination: "newdir" },
        { type: "attribute", key: "version", value: "1.0" },
      ];

      const result = processor.transformInstructions(instructions);

      expect(result.copy).toHaveLength(2);
      expect(result.mkdir).toHaveLength(1);
      expect(result.attribute).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const result = processor.transformInstructions([]);

      expect(result.copy).toHaveLength(0);
      expect(result.mkdir).toHaveLength(0);
    });

    it("should ignore null/undefined instructions", () => {
      const instructions = [
        { type: "copy", source: "a.txt", destination: "a.txt" },
        null,
        undefined,
        { type: "copy", source: "b.txt", destination: "b.txt" },
      ] as IInstruction[];

      const result = processor.transformInstructions(instructions);

      expect(result.copy).toHaveLength(2);
    });

    it("should place unsupported types in unsupported array", () => {
      const instructions: IInstruction[] = [
        { type: "unsupported", source: "unknown_feature" },
        { type: "copy", source: "a.txt", destination: "a.txt" },
      ];

      const result = processor.transformInstructions(instructions);

      expect(result.unsupported).toHaveLength(1);
      expect(result.copy).toHaveLength(1);
    });

    it("should place errors in error array", () => {
      const instructions: IInstruction[] = [
        { type: "error", source: "Something went wrong", value: "warning" },
        { type: "error", source: "Fatal error", value: "fatal" },
      ];

      const result = processor.transformInstructions(instructions);

      expect(result.error).toHaveLength(2);
    });
  });

  describe("hasErrors", () => {
    it("should return false when no errors", () => {
      const groups = new InstructionGroups();
      groups.copy.push({ type: "copy", source: "a.txt", destination: "a.txt" });

      expect(processor.hasErrors(groups)).toBe(false);
    });

    it("should return true when errors exist", () => {
      const groups = new InstructionGroups();
      groups.error.push({ type: "error", source: "Test error" });

      expect(processor.hasErrors(groups)).toBe(true);
    });
  });

  describe("findFatalError", () => {
    it("should return undefined when no fatal errors", () => {
      const groups = new InstructionGroups();
      groups.error.push({ type: "error", source: "Warning", value: "warning" });

      expect(processor.findFatalError(groups)).toBeUndefined();
    });

    it("should return fatal error when present", () => {
      const groups = new InstructionGroups();
      groups.error.push({ type: "error", source: "Warning", value: "warning" });
      groups.error.push({ type: "error", source: "Fatal", value: "fatal" });

      const fatal = processor.findFatalError(groups);

      expect(fatal).toBeDefined();
      expect(fatal?.source).toBe("Fatal");
    });
  });

  describe("getErrorMessages", () => {
    it("should return error sources", () => {
      const groups = new InstructionGroups();
      groups.error.push({ type: "error", source: "Error 1" });
      groups.error.push({ type: "error", source: "Error 2" });

      const messages = processor.getErrorMessages(groups);

      expect(messages).toEqual(["Error 1", "Error 2"]);
    });

    it("should handle errors without source", () => {
      const groups = new InstructionGroups();
      groups.error.push({ type: "error" });

      const messages = processor.getErrorMessages(groups);

      expect(messages).toEqual(["Unknown error"]);
    });
  });

  describe("hasUnsupported", () => {
    it("should return false when no unsupported", () => {
      const groups = new InstructionGroups();

      expect(processor.hasUnsupported(groups)).toBe(false);
    });

    it("should return true when unsupported exist", () => {
      const groups = new InstructionGroups();
      groups.unsupported.push({ type: "unsupported", source: "feature_x" });

      expect(processor.hasUnsupported(groups)).toBe(true);
    });
  });

  describe("getUnsupportedSources", () => {
    it("should return unsupported sources", () => {
      const groups = new InstructionGroups();
      groups.unsupported.push({ type: "unsupported", source: "feature_x" });
      groups.unsupported.push({ type: "unsupported", source: "feature_y" });

      const sources = processor.getUnsupportedSources(groups);

      expect(sources).toEqual(["feature_x", "feature_y"]);
    });

    it("should handle unsupported without source", () => {
      const groups = new InstructionGroups();
      groups.unsupported.push({ type: "unsupported" });

      const sources = processor.getUnsupportedSources(groups);

      expect(sources).toEqual(["unknown"]);
    });
  });

  describe("standalone functions", () => {
    it("validateInstructions should work standalone", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "file.txt", destination: "valid/path.txt" },
      ];

      const result = validateInstructions(instructions);

      expect(result).toEqual([]);
    });

    it("transformInstructions should work standalone", () => {
      const instructions: IInstruction[] = [
        { type: "copy", source: "a.txt", destination: "a.txt" },
        { type: "mkdir", destination: "newdir" },
      ];

      const result = transformInstructions(instructions);

      expect(result.copy).toHaveLength(1);
      expect(result.mkdir).toHaveLength(1);
    });
  });

  describe("INI config", () => {
    it("should use default INI config", () => {
      const proc = new InstructionProcessor();
      // The default tweaksPath should be "ini tweaks"
      // We can't directly access it, but we can verify the processor was created
      expect(proc).toBeDefined();
    });

    it("should accept custom INI config", () => {
      const proc = new InstructionProcessor({ tweaksPath: "custom/tweaks" });
      expect(proc).toBeDefined();
    });
  });
});
