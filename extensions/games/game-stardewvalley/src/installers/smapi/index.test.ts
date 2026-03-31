/**
 * Tests the shared SMAPI helpers.
 * The install flows stay in separate files so it is easy to see which platform
 * failed.
 */
import { describe, expect, test } from "vitest";

// Arrange: load the mock before the module under test.
import "./fixtures/vortexApi.mock";

import {
  isSMAPIModType,
  linuxSMAPIPlatform,
  macosSMAPIPlatform,
  resolveSMAPIPlatform,
  windowsSMAPIPlatform,
} from "./index";
import { types } from "vortex-api";

describe("installers/smapi platform resolution", () => {
  test("returns windows variant for win32", () => {
    // Act: resolve the platform.
    const resolved = resolveSMAPIPlatform("win32");

    // Assert: use the Windows settings.
    expect(resolved).toBe(windowsSMAPIPlatform);
    expect(resolved.executableName).toBe("StardewModdingAPI.exe");
  });

  test("returns linux variant for linux", () => {
    // Act: resolve the platform.
    const resolved = resolveSMAPIPlatform("linux");

    // Assert: use the Linux settings.
    expect(resolved).toBe(linuxSMAPIPlatform);
    expect(resolved.executableName).toBe("StardewModdingAPI");
  });

  test("returns macOS stub variant for darwin", () => {
    // Act: resolve the platform.
    const resolved = resolveSMAPIPlatform("darwin");

    // Assert: use the macOS stub.
    expect(resolved).toBe(macosSMAPIPlatform);
    expect(resolved.implemented).toBe(false);
  });

  test("throws for unknown platforms", () => {
    // Arrange: cast a fake platform value.

    // Act + assert: reject unsupported platforms.
    expect(() => resolveSMAPIPlatform("plan9" as NodeJS.Platform)).toThrow(
      "Unsupported platform for SMAPI installer",
    );
  });
});

describe("installers/smapi isSMAPIModType", () => {
  test("matches windows executable instructions from extracted install.dat payload", async () => {
    // Arrange: include the Windows executable.
    const instructions: types.IInstruction[] = [
      { type: "copy", source: "StardewModdingAPI.exe" },
    ];

    // Act + assert: match it as SMAPI.
    await expect(
      isSMAPIModType(instructions, windowsSMAPIPlatform),
    ).resolves.toBe(true);
  });

  test("matches linux executable instructions from extracted install.dat payload", async () => {
    // Arrange: include the Linux executable.
    const instructions: types.IInstruction[] = [
      { type: "copy", source: "StardewModdingAPI" },
    ];

    // Act + assert: match it as SMAPI.
    await expect(
      isSMAPIModType(instructions, linuxSMAPIPlatform),
    ).resolves.toBe(true);
  });

  test("does not match instructions for a different platform executable", async () => {
    // Arrange: use a Windows path for a Linux check.
    const instructions: types.IInstruction[] = [
      { type: "copy", source: "internal/windows/StardewModdingAPI.exe" },
    ];

    // Act + assert: do not match the wrong platform.
    await expect(
      isSMAPIModType(instructions, linuxSMAPIPlatform),
    ).resolves.toBe(false);
  });
});
