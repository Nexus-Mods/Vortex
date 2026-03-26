/**
 * Tests the minimal archive-classifier regression cases for Stardew Valley.
 */
import path from "path";
import { describe, expect, test } from "vitest";

import { GAME_ID } from "../common";
import { classifyArchive, makeInstallerTestResult } from "./archiveClassifier";

describe("installers/archiveClassifier", () => {
  test("marks only Stardew Valley archives as game archives", () => {
    expect(classifyArchive([], GAME_ID).isGameArchive).toBe(true);
    expect(classifyArchive([], "skyrim").isGameArchive).toBe(false);
  });

  test("detects native Content directory entries", () => {
    expect(
      classifyArchive([nativeDirectory("SomePack", "Content")], GAME_ID)
        .hasContentFolder,
    ).toBe(true);
  });

  test("detects backslash Content directory entries", () => {
    expect(
      classifyArchive(["SomePack\\Content\\"], GAME_ID).hasContentFolder,
    ).toBe(true);
  });

  test("detects native manifests and preserves case-insensitive matching", () => {
    expect(
      classifyArchive([nativePath("SomePack", "Manifest.JSON")], GAME_ID)
        .hasManifest,
    ).toBe(true);
  });

  test("detects backslash manifests", () => {
    expect(
      classifyArchive(["SomePack\\manifest.json"], GAME_ID).hasManifest,
    ).toBe(true);
  });

  test("detects native SMAPI installer DLLs and preserves case-insensitive matching", () => {
    expect(
      classifyArchive(
        [nativePath("internal", "windows", "SMAPI.Installer.DLL")],
        GAME_ID,
      ).hasSmapiInstallerDll,
    ).toBe(true);
  });

  test("detects backslash SMAPI installer DLLs", () => {
    expect(
      classifyArchive(["internal\\windows\\SMAPI.Installer.dll"], GAME_ID)
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
