/**
 * Verifies the public SMAPI helpers exposed from `smapi/index.ts`.
 * Basic archive-detection checks stay here, while platform-specific install flows
 * live in the sibling test files.
 */
import path from "path";
import { describe, expect, test } from "vitest";

// Arrange: load the mock before the module under test.
import "./fixtures/vortexApi.mock";

import { GAME_ID } from "../../common";
import {
  isSMAPIModType,
  linuxSMAPIPlatform,
  macosSMAPIPlatform,
  resolveSMAPIPlatform,
  testSMAPI,
  windowsSMAPIPlatform,
} from "./index";

// Detects correct platform variants for SMAPI.
describe("installers/smapi platform resolution", () => {
  test.each([
    {
      label: "Windows",
      nodePlatform: "win32" as NodeJS.Platform,
      expectedPlatform: windowsSMAPIPlatform,
      executableName: "StardewModdingAPI.exe",
      implemented: true,
    },
    {
      label: "Linux",
      nodePlatform: "linux" as NodeJS.Platform,
      expectedPlatform: linuxSMAPIPlatform,
      executableName: "StardewModdingAPI",
      implemented: true,
    },
    {
      label: "macOS",
      nodePlatform: "darwin" as NodeJS.Platform,
      expectedPlatform: macosSMAPIPlatform,
      executableName: "StardewModdingAPI",
      implemented: false,
    },
  ])(
    "returns the $label variant for $nodePlatform",
    ({ nodePlatform, expectedPlatform, executableName, implemented }) => {
      const resolved = resolveSMAPIPlatform(nodePlatform);

      expect(resolved).toBe(expectedPlatform);
      expect(resolved.executableName).toBe(executableName);
      expect(resolved.implemented).toBe(implemented);
    },
  );

  test("throws for unknown platforms", () => {
    expect(() => resolveSMAPIPlatform("plan9" as NodeJS.Platform)).toThrow(
      "Unsupported platform for SMAPI installer",
    );
  });
});

// Check that each platform is recognised correctly when the install instructions
// include the executable name that SMAPI expects for that platform.
describe("installers/smapi isSMAPIModType", () => {
  test.each([
    {
      label: "Windows",
      instructions: [{ type: "copy", source: "StardewModdingAPI.exe" }] as any,
      platform: windowsSMAPIPlatform,
    },
    {
      label: "Linux",
      instructions: [{ type: "copy", source: "StardewModdingAPI" }] as any,
      platform: linuxSMAPIPlatform,
    },
  ])(
    "matches the $label executable from extracted install.dat payload",
    async ({ instructions, platform }) => {
      await expect(isSMAPIModType(instructions, platform)).resolves.toBe(true);
    },
  );

  // Do not treat a Windows executable as a Linux SMAPI install.
  test("does not match instructions for a different platform executable", async () => {
    const instructions = [
      { type: "copy", source: "internal/windows/StardewModdingAPI.exe" },
    ] as any;

    await expect(
      isSMAPIModType(instructions, linuxSMAPIPlatform),
    ).resolves.toBe(false);
  });
});

describe("installers/smapi archive detection", () => {
  test("claims native nested SMAPI installer archives for Stardew Valley", async () => {
    await expect(
      testSMAPI(
        [nativePath("internal", "windows", "SMAPI.Installer.dll")],
        GAME_ID,
      ),
    ).resolves.toEqual({ supported: true, requiredFiles: [] });
  });

  test("claims backslash-only installer entries", async () => {
    await expect(
      testSMAPI(["internal\\windows\\SMAPI.Installer.dll"], GAME_ID),
    ).resolves.toEqual({
      supported: true,
      requiredFiles: [],
    });
  });

  test("does not claim archives for the wrong game", async () => {
    await expect(
      testSMAPI(
        [nativePath("internal", "windows", "SMAPI.Installer.dll")],
        "skyrim",
      ),
    ).resolves.toEqual({ supported: false, requiredFiles: [] });
  });
});

function nativePath(...segments: string[]): string {
  // Use host-native separators when the test is checking the native-path code path.
  return segments.join(path.sep);
}
