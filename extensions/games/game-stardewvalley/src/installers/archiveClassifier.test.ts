/**
 * Tests the minimal archive-classifier regression cases for Stardew Valley.
 */
import path from "path";
import { describe, expect, test } from "vitest";

import { classifyArchive, makeInstallerTestResult } from "./archiveClassifier";

describe("installers/archiveClassifier", () => {
  test("detects native Content directory entries", () => {
    expect(
      classifyArchive([nativeDirectory("SomePack", "Content")])
        .hasContentFolder,
    ).toBe(true);
  });

  test("detects backslash Content directory entries", () => {
    expect(classifyArchive(["SomePack\\Content\\"]).hasContentFolder).toBe(
      true,
    );
  });

  test("detects native manifests and preserves case-insensitive matching", () => {
    expect(
      classifyArchive([nativePath("SomePack", "Manifest.JSON")]).hasManifest,
    ).toBe(true);
  });

  test("ignores locale manifests case-insensitively", () => {
    expect(
      classifyArchive([nativePath("SomePack", "Locale", "manifest.json")])
        .hasManifest,
    ).toBe(false);
  });

  test("detects backslash manifests", () => {
    expect(classifyArchive(["SomePack\\manifest.json"]).hasManifest).toBe(true);
  });

  test("detects native SMAPI installer DLLs and preserves case-insensitive matching", () => {
    expect(
      classifyArchive([
        nativePath("internal", "windows", "SMAPI.Installer.DLL"),
      ]).hasSmapiInstallerDll,
    ).toBe(true);
  });

  test("detects backslash SMAPI installer DLLs", () => {
    expect(
      classifyArchive(["internal\\windows\\SMAPI.Installer.dll"])
        .hasSmapiInstallerDll,
    ).toBe(true);
  });

  test("returns the shared installer payload shape", () => {
    expect(makeInstallerTestResult(true)).toEqual({
      supported: true,
      requiredFiles: [],
    });
    expect(makeInstallerTestResult(false)).toEqual({
      supported: false,
      requiredFiles: [],
    });
  });
});

function nativePath(...segments: string[]): string {
  return segments.join(path.sep);
}

function nativeDirectory(...segments: string[]): string {
  return `${nativePath(...segments)}${path.sep}`;
}
