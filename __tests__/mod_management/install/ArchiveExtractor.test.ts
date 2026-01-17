import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import Bluebird from "bluebird";
import { ArchiveExtractor } from "../../../src/extensions/mod_management/install/ArchiveExtractor";
import { ArchiveBrokenError } from "../../../src/util/CustomErrors";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

describe("ArchiveExtractor", () => {
  let mockZip: any;
  let extractor: ArchiveExtractor;

  beforeEach(() => {
    mockZip = {
      extractFull: jest.fn(),
    };
    extractor = new ArchiveExtractor(mockZip);
  });

  describe("extract", () => {
    it("should successfully extract an archive", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.resolve({ code: 0, errors: [] })
      );

      const result = await extractor.extract(
        "/path/to/archive.zip",
        "/path/to/dest"
      );

      expect(result.code).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockZip.extractFull).toHaveBeenCalledTimes(1);
    });

    it("should pass progress callback to extractFull", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.resolve({ code: 0, errors: [] })
      );
      const progressFn = jest.fn();

      await extractor.extract("/path/to/archive.zip", "/path/to/dest", {
        onProgress: progressFn,
      });

      expect(mockZip.extractFull).toHaveBeenCalledWith(
        "/path/to/archive.zip",
        "/path/to/dest",
        { ssc: false },
        progressFn,
        undefined
      );
    });

    it("should pass password query callback to extractFull", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.resolve({ code: 0, errors: [] })
      );
      const passwordFn = jest.fn(() => Promise.resolve("secret"));

      await extractor.extract("/path/to/archive.zip", "/path/to/dest", {
        queryPassword: passwordFn,
      });

      expect(mockZip.extractFull).toHaveBeenCalledWith(
        "/path/to/archive.zip",
        "/path/to/dest",
        { ssc: false },
        undefined,
        passwordFn
      );
    });

    it("should reject with ArchiveBrokenError for .dll files", async () => {
      await expect(
        extractor.extract("/path/to/file.dll", "/path/to/dest")
      ).rejects.toThrow(ArchiveBrokenError);

      expect(mockZip.extractFull).not.toHaveBeenCalled();
    });

    it("should reject with ArchiveBrokenError for critical errors", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.reject(new Error("Unexpected end of archive"))
      );

      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest")
      ).rejects.toThrow(ArchiveBrokenError);
    });

    it('should reject with ArchiveBrokenError for "Cannot open file as archive" errors', async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.reject(new Error("Cannot open the file as archive"))
      );

      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest")
      ).rejects.toThrow(ArchiveBrokenError);
    });
  });

  describe("retry logic", () => {
    it("should retry on file-in-use error", async () => {
      let callCount = 0;
      mockZip.extractFull.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Bluebird.reject(
            new Error("File is being used by another process")
          );
        }
        return Bluebird.resolve({ code: 0, errors: [] });
      });

      const result = await extractor.extract(
        "/path/to/archive.zip",
        "/path/to/dest",
        { retryDelayMs: 10 } // Use small delay for tests
      );

      expect(result.code).toBe(0);
      expect(mockZip.extractFull).toHaveBeenCalledTimes(3);
    });

    it("should respect maxRetries option", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.reject(new Error("File is being used by another process"))
      );

      // With maxRetries: 2, we expect 3 total attempts (initial + 2 retries)
      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest", {
          maxRetries: 2,
          retryDelayMs: 10,
        })
      ).rejects.toThrow("File is being used by another process");

      expect(mockZip.extractFull).toHaveBeenCalledTimes(3);
    });

    it("should not retry on critical errors", async () => {
      mockZip.extractFull.mockReturnValue(
        Bluebird.reject(new Error("Unexpected end of archive"))
      );

      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest", {
          maxRetries: 3,
          retryDelayMs: 10,
        })
      ).rejects.toThrow(ArchiveBrokenError);

      // Should only try once - no retries for critical errors
      expect(mockZip.extractFull).toHaveBeenCalledTimes(1);
    });

    it("should use config defaults when options not provided", async () => {
      const customExtractor = new ArchiveExtractor(mockZip, {
        defaultMaxRetries: 5,
        defaultRetryDelayMs: 100,
      });

      mockZip.extractFull.mockReturnValue(
        Bluebird.reject(new Error("File is being used by another process"))
      );

      await expect(
        customExtractor.extract("/path/to/archive.zip", "/path/to/dest")
      ).rejects.toThrow();

      // 5 retries + 1 initial attempt = 6 total calls
      expect(mockZip.extractFull).toHaveBeenCalledTimes(6);
    });
  });

  describe("static methods", () => {
    describe("isArchiveExtension", () => {
      it("should return true for supported archive extensions", () => {
        expect(ArchiveExtractor.isArchiveExtension(".zip")).toBe(true);
        expect(ArchiveExtractor.isArchiveExtension(".7z")).toBe(true);
        expect(ArchiveExtractor.isArchiveExtension(".rar")).toBe(true);
        expect(ArchiveExtractor.isArchiveExtension(".gz")).toBe(true);
      });

      it("should handle extensions without leading dot", () => {
        expect(ArchiveExtractor.isArchiveExtension("zip")).toBe(true);
        expect(ArchiveExtractor.isArchiveExtension("7z")).toBe(true);
      });

      it("should be case insensitive", () => {
        expect(ArchiveExtractor.isArchiveExtension(".ZIP")).toBe(true);
        expect(ArchiveExtractor.isArchiveExtension(".Zip")).toBe(true);
      });

      it("should return false for unsupported extensions", () => {
        expect(ArchiveExtractor.isArchiveExtension(".txt")).toBe(false);
        expect(ArchiveExtractor.isArchiveExtension(".exe")).toBe(false);
        expect(ArchiveExtractor.isArchiveExtension(".dll")).toBe(false);
      });
    });

    describe("shouldAvoidExtraction", () => {
      it("should return true for .dll files", () => {
        expect(ArchiveExtractor.shouldAvoidExtraction("/path/to/file.dll")).toBe(
          true
        );
        expect(ArchiveExtractor.shouldAvoidExtraction("/path/to/file.DLL")).toBe(
          true
        );
      });

      it("should return false for archive files", () => {
        expect(
          ArchiveExtractor.shouldAvoidExtraction("/path/to/archive.zip")
        ).toBe(false);
        expect(
          ArchiveExtractor.shouldAvoidExtraction("/path/to/archive.7z")
        ).toBe(false);
      });
    });

    describe("getArchiveBaseName", () => {
      it("should extract base name without extension", () => {
        expect(ArchiveExtractor.getArchiveBaseName("/path/to/MyMod-v1.0.zip")).toBe(
          "MyMod-v1.0"
        );
        expect(ArchiveExtractor.getArchiveBaseName("/path/to/archive.7z")).toBe(
          "archive"
        );
      });

      it("should trim whitespace", () => {
        expect(
          ArchiveExtractor.getArchiveBaseName("/path/to/  MyMod  .zip")
        ).toBe("MyMod");
      });

      it("should handle hidden files (dot files)", () => {
        // .zip is treated as a hidden file named ".zip" not as extension
        expect(ArchiveExtractor.getArchiveBaseName("/path/to/.zip")).toBe(".zip");
      });

      it('should return "mod" for whitespace-only basename', () => {
        expect(ArchiveExtractor.getArchiveBaseName("/path/to/   .zip")).toBe("mod");
      });
    });
  });

  describe("error handling", () => {
    it("should pass through non-retryable, non-critical errors", async () => {
      const customError = new Error("Some random error");
      mockZip.extractFull.mockReturnValue(Bluebird.reject(customError));

      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest")
      ).rejects.toThrow("Some random error");

      expect(mockZip.extractFull).toHaveBeenCalledTimes(1);
    });

    it("should handle errors with empty message", async () => {
      mockZip.extractFull.mockReturnValue(Bluebird.reject(new Error("")));

      await expect(
        extractor.extract("/path/to/archive.zip", "/path/to/dest")
      ).rejects.toThrow();

      expect(mockZip.extractFull).toHaveBeenCalledTimes(1);
    });
  });
});
