/**
 * Tests the Windows SMAPI install path with real `install.dat` listings.
 */
import { beforeEach, describe, expect, test } from "vitest";

import {
  archiveFileEntries,
  smapiInstallerArchiveEntries,
  walkArchiveEntries,
  windowsInstallDatEntries,
} from "./fixtures/archiveListings";
import {
  SevenZipMock,
  extractFullMock,
  readFileAsyncMock,
  resetVortexApiMocks,
  walkMock,
} from "./fixtures/vortexApi.mock";
import { installSMAPI, windowsSMAPIPlatform } from "./index";

const normalizePathSeparators = (input: string) => input.replace(/\\/g, "/");

describe("installers/smapi installSMAPI (windows)", () => {
  beforeEach(() => {
    resetVortexApiMocks();
  });

  test("uses real windows install.dat listing and extracts the Windows executable", async () => {
    // Arrange: use the real installer file list.
    const files = smapiInstallerArchiveEntries;
    const destinationPath = "/staging";

    walkMock.mockImplementation(
      async (
        _destination: string,
        cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>,
      ) => {
        // Arrange: replay the staged archive contents.
        await walkArchiveEntries(destinationPath, [...files, ...windowsInstallDatEntries], cb);
      },
    );

    // Act: run the Windows install flow.
    const result = await installSMAPI(() => "/game", files, destinationPath, windowsSMAPIPlatform);
    const [extractSource, extractDestination] = extractFullMock.mock.lastCall ?? [];
    const [depsFilePath, depsReadOptions] = readFileAsyncMock.mock.lastCall ?? [];
    const copyInstructions = result.instructions.filter((instr) => instr.type === "copy");

    // Assert: extract the Windows payload and emit the right files.
    expect(SevenZipMock).toHaveBeenCalledTimes(1);
    expect(normalizePathSeparators(extractSource)).toBe("/staging/internal/windows/install.dat");
    expect(extractDestination).toBe("/staging");
    expect(copyInstructions).toHaveLength(archiveFileEntries(windowsInstallDatEntries).length);
    expect(copyInstructions.some((instr) => instr.source === "StardewModdingAPI.exe")).toBe(true);
    expect(copyInstructions.some((instr) => instr.source === "smapi-internal/config.json")).toBe(
      true,
    );
    expect(
      copyInstructions.some(
        (instr) => typeof instr.source === "string" && instr.source.startsWith("internal/windows/"),
      ),
    ).toBe(false);
    expect(
      result.instructions.some(
        (instr) =>
          instr.type === "generatefile" && instr.destination === "StardewModdingAPI.deps.json",
      ),
    ).toBe(true);
    expect(normalizePathSeparators(depsFilePath)).toBe("/game/Stardew Valley.deps.json");
    expect(depsReadOptions).toEqual({ encoding: "utf8" });
    expect(walkMock).toHaveBeenCalledTimes(1);
  });

  test("fails when windows executable is missing from extracted payload", async () => {
    // Arrange: drop the main executable from the payload.
    const files = smapiInstallerArchiveEntries;
    const entriesWithoutExe = windowsInstallDatEntries.filter(
      (entry) => entry !== "StardewModdingAPI.exe",
    );

    walkMock.mockImplementation(
      async (
        _destination: string,
        cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>,
      ) => {
        // Arrange: replay the broken extracted payload.
        await walkArchiveEntries("/staging", entriesWithoutExe, cb);
      },
    );

    // Act + assert: fail when the exe is missing.
    await expect(
      installSMAPI(() => "/game", files, "/staging", windowsSMAPIPlatform),
    ).rejects.toThrow("Failed to extract StardewModdingAPI.exe");
  });
});
