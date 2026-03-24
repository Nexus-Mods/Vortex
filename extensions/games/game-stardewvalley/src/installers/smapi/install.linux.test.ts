/**
 * Tests the Linux SMAPI install path with real `install.dat` listings.
 */
import { beforeEach, describe, expect, test } from "vitest";

import {
  SevenZipMock,
  extractFullMock,
  resetVortexApiMocks,
  walkMock,
} from "./fixtures/vortexApi.mock";
import { installSMAPI, linuxSMAPIPlatform } from "./index";
import {
  archiveFileEntries,
  linuxInstallDatEntries,
  smapiInstallerArchiveEntries,
  walkArchiveEntries,
} from "./fixtures/archiveListings";

const normalizePathSeparators = (input: string) => input.replace(/\\/g, "/");

describe("installers/smapi installSMAPI (linux)", () => {
  beforeEach(() => {
    resetVortexApiMocks();
  });

  test("uses real linux install.dat listing and extracts the Linux executable", async () => {
    // Arrange: use the real installer file list.
    const files = smapiInstallerArchiveEntries;

    walkMock.mockImplementation(
      async (
        _destination: string,
        cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>,
      ) => {
        // Arrange: replay the staged archive contents.
        await walkArchiveEntries(
          "/staging",
          [...files, ...linuxInstallDatEntries],
          cb,
        );
      },
    );

    // Act: run the Linux install flow.
    const result = await installSMAPI(
      () => "/game",
      files,
      "/staging",
      linuxSMAPIPlatform,
    );
    const [extractSource, extractDestination] =
      extractFullMock.mock.lastCall ?? [];
    const copyInstructions = result.instructions.filter(
      (instr) => instr.type === "copy",
    );

    // Assert: extract the Linux payload and emit the right files.
    expect(SevenZipMock).toHaveBeenCalledTimes(1);
    expect(normalizePathSeparators(extractSource as string)).toBe(
      "/staging/internal/linux/install.dat",
    );
    expect(extractDestination).toBe("/staging");
    expect(copyInstructions).toHaveLength(
      archiveFileEntries(linuxInstallDatEntries).length,
    );
    expect(
      copyInstructions.some((instr) => instr.source === "StardewModdingAPI"),
    ).toBe(true);
    expect(
      copyInstructions.some(
        (instr) => instr.source === "smapi-internal/config.json",
      ),
    ).toBe(true);
    expect(
      copyInstructions.some(
        (instr) =>
          typeof instr.source === "string" &&
          instr.source.startsWith("internal/linux/"),
      ),
    ).toBe(false);
    expect(
      result.instructions.some(
        (instr) =>
          instr.type === "generatefile" &&
          instr.destination === "StardewModdingAPI.deps.json",
      ),
    ).toBe(true);
  });

  test("fails when platform data archive is missing", async () => {
    // Arrange: remove the Linux archive payload.
    const files = smapiInstallerArchiveEntries.filter(
      (file) => file !== "internal/linux/install.dat",
    );

    // Act + assert: fail with the missing-data error.
    await expect(
      installSMAPI(() => "/game", files, "/staging", linuxSMAPIPlatform),
    ).rejects.toThrow("Failed to find the SMAPI data files");
  });
});
