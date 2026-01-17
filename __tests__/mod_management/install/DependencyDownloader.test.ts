import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import Bluebird from "bluebird";
import {
  DependencyDownloader,
  downloadURL,
  downloadMatching,
  downloadDependencyAsync,
} from "../../../src/extensions/mod_management/install/DependencyDownloader";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock selectors
jest.mock("../../../src/util/selectors", () => ({
  knownGames: jest.fn(() => [{ id: "skyrimse", domain: "skyrimspecialedition" }]),
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

// Mock util
jest.mock("../../../src/util/util", () => ({
  truthy: jest.fn((val: any) => !!val),
}));

// Mock DownloadManager errors
jest.mock(
  "../../../src/extensions/download_management/DownloadManager",
  () => ({
    AlreadyDownloaded: class AlreadyDownloaded extends Error {
      downloadId?: string;
      constructor(message: string, downloadId?: string) {
        super(message);
        this.downloadId = downloadId;
      }
    },
    DownloadIsHTML: class DownloadIsHTML extends Error {},
  }),
);

// Mock download actions
jest.mock(
  "../../../src/extensions/download_management/actions/state",
  () => ({
    setDownloadModInfo: jest.fn((dlId, key, value) => ({
      type: "SET_DOWNLOAD_MOD_INFO",
      payload: { dlId, key, value },
    })),
  }),
);

// Mock convertGameIdReverse
jest.mock(
  "../../../src/extensions/nexus_integration/util/convertGameId",
  () => ({
    convertGameIdReverse: jest.fn(
      (games: any, domain: string) => domain || "skyrimse",
    ),
  }),
);

// Mock testModReference
jest.mock(
  "../../../src/extensions/mod_management/util/testModReference",
  () => ({
    isFuzzyVersion: jest.fn((version: string) => version?.includes("*") || version?.includes("+")),
  }),
);

// Helper to create mock lookup result
function createMockLookupResult(overrides: any = {}) {
  return {
    sourceURI: "https://example.com/mod.zip",
    referer: "https://example.com",
    domainName: "skyrimspecialedition",
    source: "nexus",
    logicalFileName: "test-mod",
    fileName: "test-mod.zip",
    archived: false,
    details: {
      modId: "12345",
      fileId: "67890",
    },
    ...overrides,
  };
}

// Helper to create mock API
function createMockApi(overrides: any = {}) {
  const store = {
    getState: jest.fn(() => ({})),
    dispatch: jest.fn(),
  };

  return {
    getState: jest.fn(() => ({})),
    store,
    events: {
      emit: jest.fn((...args: any[]) => {
        // Simulate successful download by calling the callback
        const callback = args.find((arg) => typeof arg === "function");
        if (callback) {
          setTimeout(() => callback(null, "dl-123"), 0);
        }
        return true;
      }),
    },
    emitAndAwait: jest.fn(() =>
      Promise.resolve([{ error: null, dlId: "dl-456" }])
    ),
    ...overrides,
  } as any;
}

describe("DependencyDownloader", () => {
  describe("downloadURL", () => {
    it("should reject with UserCanceled when already canceled", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => true;

      await expect(
        downloadURL(mockApi, lookupResult, wasCanceled),
      ).rejects.toThrow();
    });

    it("should reject with UserCanceled when sourceURI is falsy", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult({ sourceURI: "" });
      const wasCanceled = () => false;

      await expect(
        downloadURL(mockApi, lookupResult, wasCanceled),
      ).rejects.toThrow();
    });

    it("should emit start-download event with correct parameters", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      // Start the download but don't await (to check emit was called)
      const promise = downloadURL(mockApi, lookupResult, wasCanceled, "test-tag");

      // Give time for the promise chain to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockApi.events.emit).toHaveBeenCalledWith(
        "start-download",
        expect.any(Array),
        expect.objectContaining({
          source: "nexus",
          referenceTag: "test-tag",
        }),
        undefined,
        expect.any(Function),
        "never",
        { allowInstall: false, allowOpenHTML: false },
      );

      // Resolve the promise
      await promise;
    });

    it("should resolve with download ID on successful download", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloadURL(mockApi, lookupResult, wasCanceled);

      expect(result).toBe("dl-123");
    });
  });

  describe("downloadMatching", () => {
    it("should fall back to downloadURL when no modId or fileId", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult({
        details: {},
      });
      const wasCanceled = () => false;

      const result = await downloadMatching(
        mockApi,
        lookupResult,
        "1.0.*",
        "test-tag",
        wasCanceled,
        "campaign-1",
      );

      expect(result).toBe("dl-123");
      // Should have called start-download (via downloadURL fallback)
      expect(mockApi.events.emit).toHaveBeenCalled();
      // Should NOT have called start-download-update since no modId/fileId
      expect(mockApi.emitAndAwait).not.toHaveBeenCalled();
    });

    it("should emit start-download-update when modId is present", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloadMatching(
        mockApi,
        lookupResult,
        "1.0.*",
        "test-tag",
        wasCanceled,
        "campaign-1",
      );

      expect(mockApi.emitAndAwait).toHaveBeenCalledWith(
        "start-download-update",
        "nexus",
        expect.anything(),
        "12345",
        "67890",
        "1.0.*",
        "campaign-1",
        "test-tag",
      );
      expect(result).toBe("dl-456");
    });

    it("should dispatch setDownloadModInfo on successful match", async () => {
      const mockApi = createMockApi();
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      await downloadMatching(
        mockApi,
        lookupResult,
        "1.0.*",
        "test-tag",
        wasCanceled,
        "campaign-1",
      );

      expect(mockApi.store.dispatch).toHaveBeenCalled();
    });
  });

  describe("downloadDependencyAsync", () => {
    it("should use downloadURL for non-fuzzy versions", async () => {
      const mockApi = createMockApi();
      const requirement = {
        tag: "req-tag",
        versionMatch: "1.0.0",
      } as any;
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloadDependencyAsync(
        mockApi,
        requirement,
        lookupResult,
        wasCanceled,
        "test.zip",
      );

      expect(result).toBe("dl-123");
      expect(mockApi.events.emit).toHaveBeenCalledWith(
        "start-download",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it("should use downloadMatching for fuzzy versions", async () => {
      const mockApi = createMockApi();
      const requirement = {
        tag: "req-tag",
        versionMatch: "1.0.*",
      } as any;
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloadDependencyAsync(
        mockApi,
        requirement,
        lookupResult,
        wasCanceled,
        "test.zip",
      );

      expect(result).toBe("dl-456");
      // Should have used downloadMatching which calls start-download-update
      expect(mockApi.emitAndAwait).toHaveBeenCalledWith(
        "start-download-update",
        "nexus",
        expect.anything(),
        "12345",
        "67890",
        "1.0.*",
        undefined, // campaign is undefined in this test
        "req-tag",
      );
    });

    it("should handle +prefer versions", async () => {
      const mockApi = createMockApi();
      const requirement = {
        tag: "req-tag",
        versionMatch: "1.0.0+prefer",
      } as any;
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloadDependencyAsync(
        mockApi,
        requirement,
        lookupResult,
        wasCanceled,
        "test.zip",
      );

      // +prefer versions should use downloadURL first
      expect(result).toBe("dl-123");
    });
  });

  describe("DependencyDownloader class", () => {
    let downloader: DependencyDownloader;
    let mockApi: any;

    beforeEach(() => {
      mockApi = createMockApi();
      downloader = new DependencyDownloader(mockApi);
    });

    it("should provide downloadURL method", async () => {
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloader.downloadURL(
        lookupResult,
        wasCanceled,
        "test-tag",
      );

      expect(result).toBe("dl-123");
    });

    it("should provide downloadMatching method", async () => {
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloader.downloadMatching(
        lookupResult,
        "1.0.*",
        "test-tag",
        wasCanceled,
        "campaign-1",
      );

      expect(result).toBe("dl-456");
    });

    it("should provide downloadDependencyAsync method", async () => {
      const requirement = { tag: "req-tag" } as any;
      const lookupResult = createMockLookupResult();
      const wasCanceled = () => false;

      const result = await downloader.downloadDependencyAsync(
        requirement,
        lookupResult,
        wasCanceled,
        "test.zip",
      );

      expect(result).toBe("dl-123");
    });
  });
});
