import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import Bluebird from "bluebird";
import {
  getInstaller,
  determineModType,
  deriveInstallName,
  reportUnsupported,
  InstallerSelector,
} from "../../../src/extensions/mod_management/install/InstallerSelector";

// Mock the log utility
jest.mock("../../../src/util/log", () => ({
  log: jest.fn(),
}));

// Mock errorHandling
jest.mock("../../../src/util/errorHandling", () => ({
  createErrorReport: jest.fn(),
  didIgnoreError: jest.fn(() => false),
  isOutdated: jest.fn(() => false),
}));

// Mock getGame
jest.mock("../../../src/extensions/gamemode_management/util/getGame", () => ({
  getGame: jest.fn((gameId: string) => {
    if (gameId === "invalid") {
      return undefined;
    }
    return {
      modTypes: [
        {
          typeId: "default",
          priority: 100,
          test: jest.fn(() => Promise.resolve(true)),
        },
        {
          typeId: "custom",
          priority: 50,
          test: jest.fn(() => Promise.resolve(false)),
        },
      ],
    };
  }),
}));

// Mock modIdManager
jest.mock("../../../src/extensions/mod_management/modIdManager", () => ({
  __esModule: true,
  default: jest.fn((archiveName: string, info: any) => {
    return info?.name || archiveName.replace(/\.[^.]+$/, "");
  }),
}));

// Helper to create mock installers with proper typing
function createMockInstaller(
  id: string,
  priority: number,
  supported: boolean,
  requiredFiles: string[] = [],
) {
  return {
    id,
    priority,
    testSupported: jest.fn(() =>
      Promise.resolve({ supported, requiredFiles }),
    ),
    install: jest.fn(),
  } as any;
}

describe("InstallerSelector", () => {
  describe("getInstaller", () => {
    it("should return undefined when no installers match", async () => {
      const installers = [
        createMockInstaller("test-installer", 100, false),
      ];

      const result = await getInstaller(
        installers,
        ["file1.txt", "file2.txt"],
        "skyrimse",
        "/path/to/archive.zip",
      );

      expect(result).toBeUndefined();
    });

    it("should return matching installer when found", async () => {
      const installers = [
        createMockInstaller("test-installer", 100, true, ["file1.txt"]),
      ];

      const result = await getInstaller(
        installers,
        ["file1.txt", "file2.txt"],
        "skyrimse",
        "/path/to/archive.zip",
      );

      expect(result).toBeDefined();
      expect(result?.installer.id).toBe("test-installer");
      expect(result?.requiredFiles).toContain("file1.txt");
    });

    it("should try installers in order and return first match", async () => {
      const installers = [
        createMockInstaller("installer-1", 100, false),
        createMockInstaller("installer-2", 200, true, ["file2.txt"]),
      ];

      const result = await getInstaller(
        installers,
        ["file1.txt", "file2.txt"],
        "skyrimse",
        "/path/to/archive.zip",
      );

      expect(result?.installer.id).toBe("installer-2");
    });

    it("should handle empty installer list", async () => {
      const result = await getInstaller(
        [],
        ["file1.txt"],
        "skyrimse",
        "/path/to/archive.zip",
      );

      expect(result).toBeUndefined();
    });

    it("should pass offset to skip earlier installers", async () => {
      const installers = [
        createMockInstaller("installer-1", 100, true),
        createMockInstaller("installer-2", 200, true),
      ];

      const result = await getInstaller(
        installers,
        ["file1.txt"],
        "skyrimse",
        "/path/to/archive.zip",
        1, // Skip first installer
      );

      expect(result?.installer.id).toBe("installer-2");
      expect(installers[0].testSupported).not.toHaveBeenCalled();
    });
  });

  describe("determineModType", () => {
    it("should return mod type when game has matching type", async () => {
      const result = await determineModType("skyrimse", []);
      // custom has priority 50, default has 100, so custom is tested first
      // but custom returns false, so default (which returns true) should be returned
      expect(result).toBe("default");
    });

    it("should reject for invalid game", async () => {
      await expect(determineModType("invalid", [])).rejects.toThrow(
        'Invalid game "invalid"',
      );
    });
  });

  describe("deriveInstallName", () => {
    it("should derive name from archive name", () => {
      const result = deriveInstallName("my-mod-v1.0.zip", {});
      expect(result).toBe("my-mod-v1.0");
    });

    it("should use info name when available", () => {
      const result = deriveInstallName("archive.zip", { name: "Custom Name" });
      expect(result).toBe("Custom Name");
    });
  });

  describe("reportUnsupported", () => {
    it("should not report when no unsupported instructions", () => {
      const mockApi = {
        sendNotification: jest.fn(),
        genMd5Hash: jest.fn(),
        store: { dispatch: jest.fn(), getState: jest.fn(() => ({})) },
      };

      reportUnsupported(mockApi as any, [], "/path/to/archive.zip");

      expect(mockApi.sendNotification).not.toHaveBeenCalled();
    });

    it("should send notification for unsupported instructions", () => {
      const mockApi = {
        sendNotification: jest.fn(),
        genMd5Hash: jest.fn(() => Promise.resolve({ md5sum: "abc123" })),
        store: { dispatch: jest.fn(), getState: jest.fn(() => ({})) },
      };

      const unsupported = [
        { type: "unsupported" as any, source: "unknown-instruction" },
      ];

      reportUnsupported(mockApi as any, unsupported, "/path/to/archive.zip");

      expect(mockApi.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
          message: "Installer unsupported",
        }),
      );
    });
  });

  describe("InstallerSelector class", () => {
    let selector: InstallerSelector;
    let installers: any[];

    beforeEach(() => {
      installers = [
        createMockInstaller("test-installer", 100, true),
      ];
      selector = new InstallerSelector(installers);
    });

    it("should provide getInstaller method", async () => {
      const result = await selector.getInstaller(
        ["file.txt"],
        "skyrimse",
        "/archive.zip",
      );
      expect(result?.installer.id).toBe("test-installer");
    });

    it("should provide determineModType method", async () => {
      const result = await selector.determineModType("skyrimse", []);
      expect(result).toBe("default");
    });

    it("should provide deriveInstallName method", () => {
      const result = selector.deriveInstallName("mod.zip", {});
      expect(result).toBe("mod");
    });

    it("should provide reportUnsupported method", () => {
      const mockApi = {
        sendNotification: jest.fn(),
        genMd5Hash: jest.fn(),
        store: { dispatch: jest.fn(), getState: jest.fn(() => ({})) },
      };

      // Should not throw
      selector.reportUnsupported(mockApi as any, [], "/archive.zip");
      expect(mockApi.sendNotification).not.toHaveBeenCalled();
    });

    it("should use shared installers array reference", async () => {
      // Add a new installer after creation
      installers.push(createMockInstaller("new-installer", 50, true, ["new.txt"]));

      // The selector should see the new installer since it shares the array reference
      const result = await selector.getInstaller(
        ["file.txt"],
        "skyrimse",
        "/archive.zip",
      );

      // First installer (priority 100) still matches first
      expect(result?.installer.id).toBe("test-installer");
    });
  });
});
