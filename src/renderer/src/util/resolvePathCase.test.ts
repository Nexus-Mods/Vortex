import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the fs module before importing the module under test
vi.mock("./fs", () => ({
  readdirAsync: vi.fn(),
}));

import * as fs from "./fs";

import { resolvePathCase } from "./resolvePathCase";

describe("resolvePathCase", () => {
  let originalPlatform: PropertyDescriptor;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
    vi.resetAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", originalPlatform);
  });

  function setPlatform(platform: string) {
    Object.defineProperty(process, "platform", {
      value: platform,
      writable: true,
      configurable: true,
    });
  }

  it("Test 1: resolves single directory segment to existing case on disk", async () => {
    setPlatform("linux");
    // /game/Data exists on disk; relPath has 'data/SKSE/Plugins/file.dll'
    // readdir(/game) returns ['Data', 'other']
    // readdir(/game/Data) returns ['SKSE']
    // readdir(/game/Data/SKSE) throws ENOENT (Plugins doesn't exist yet)
    const mockReaddir = vi.mocked(fs.readdirAsync);
    mockReaddir.mockImplementation((dirPath: string) => {
      if (dirPath === "/game") {
        return Promise.resolve(["Data", "other"]) as any;
      }
      if (dirPath === path.join("/game", "Data")) {
        return Promise.resolve(["SKSE"]) as any;
      }
      // Plugins doesn't exist yet
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    });

    const result = await resolvePathCase("/game", "data/SKSE/Plugins/file.dll");
    // 'data' -> 'Data', 'SKSE' -> 'SKSE', 'Plugins' preserved as-is (not found)
    expect(result).toBe(path.join("/game", "Data", "SKSE", "Plugins", "file.dll"));
  });

  it("Test 2: resolves multiple directory segments including filename left as-is", async () => {
    setPlatform("linux");
    // /game/Data/Interface exists; relPath = 'data/interface/file.swf'
    const mockReaddir = vi.mocked(fs.readdirAsync);
    mockReaddir.mockImplementation((dirPath: string) => {
      if (dirPath === "/game") {
        return Promise.resolve(["Data", "Scripts"]) as any;
      }
      if (dirPath === path.join("/game", "Data")) {
        return Promise.resolve(["Interface", "Scripts"]) as any;
      }
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    });

    const result = await resolvePathCase("/game", "data/interface/file.swf");
    // 'data' -> 'Data', 'interface' -> 'Interface', filename 'file.swf' untouched
    expect(result).toBe(path.join("/game", "Data", "Interface", "file.swf"));
  });

  it("Test 3: on win32, returns path unchanged without calling readdirAsync", async () => {
    setPlatform("win32");
    const mockReaddir = vi.mocked(fs.readdirAsync);

    const result = await resolvePathCase("C:\\game", "data\\SKSE\\file.dll");
    expect(result).toBe(path.join("C:\\game", "data\\SKSE\\file.dll"));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it("Test 4: when root dir does not exist, returns path unchanged", async () => {
    setPlatform("linux");
    const mockReaddir = vi.mocked(fs.readdirAsync);
    mockReaddir.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    const result = await resolvePathCase("/nonexistent", "data/file.esp");
    expect(result).toBe(path.join("/nonexistent", "data", "file.esp"));
  });

  it("Test 6: resolves filename segment to existing case on disk", async () => {
    setPlatform("linux");
    const mockReaddir = vi.mocked(fs.readdirAsync);
    mockReaddir.mockImplementation((dirPath: string) => {
      if (dirPath === "/game") {
        return Promise.resolve(["Data"]) as any;
      }
      if (dirPath === path.join("/game", "Data")) {
        return Promise.resolve(["myplugin.esp", "other.esp"]) as any;
      }
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    });

    // Caller passes 'MyPlugin.ESP' but file on disk is 'myplugin.esp'
    const result = await resolvePathCase("/game", "Data/MyPlugin.ESP");
    expect(result).toBe(path.join("/game", "Data", "myplugin.esp"));
  });

  it("Test 5: when readdirAsync throws, preserves remaining segments as-is", async () => {
    setPlatform("linux");
    const mockReaddir = vi.mocked(fs.readdirAsync);
    mockReaddir.mockImplementation((dirPath: string) => {
      if (dirPath === "/game") {
        return Promise.resolve(["Data"]) as any;
      }
      // Subsequent readdir throws an unexpected error
      return Promise.reject(new Error("Permission denied"));
    });

    // Should not throw; 'data' -> 'Data', 'Scripts' preserved due to error
    const result = await resolvePathCase("/game", "data/Scripts/file.pex");
    expect(result).toBe(path.join("/game", "Data", "Scripts", "file.pex"));
  });
});
