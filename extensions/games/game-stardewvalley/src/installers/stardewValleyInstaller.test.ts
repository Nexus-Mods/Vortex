/**
 * Tests the minimal manifest-installer regression cases.
 */
import path from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { types } from "vortex-api";

import { GAME_ID } from "../common";
import type { ISDVModManifest } from "../types";

const stardewInstallerMocks = vi.hoisted(() => ({
  log: vi.fn(),
  parseManifest: vi.fn(),
}));

vi.mock("vortex-api", () => ({
  log: stardewInstallerMocks.log,
}));

vi.mock("../manifests/parseManifest", () => ({
  parseManifest: stardewInstallerMocks.parseManifest,
}));

import { installStardewValley, testSupported } from "./stardewValleyInstaller";

describe("installers/stardewValleyInstaller", () => {
  beforeEach(() => {
    stardewInstallerMocks.log.mockReset();
    stardewInstallerMocks.parseManifest.mockReset();
  });

  test.each([
    {
      label: "native manifest archive",
      files: [
        nativePath("Animals", "manifest.json"),
        nativePath("Animals", "Animals.dll"),
      ],
      supported: true,
    },
    {
      label: "locale-only manifest",
      files: [nativePath("Animals", "locale", "manifest.json")],
      supported: false,
    },
    {
      label: "uppercase Locale manifest",
      files: [nativePath("Animals", "Locale", "manifest.json")],
      supported: false,
    },
    {
      label: "backslash-only manifest",
      files: ["Animals\\manifest.json"],
      supported: true,
    },
  ])("claims archives for $label", async ({ files, supported }) => {
    await expect(testSupported(files, GAME_ID)).resolves.toEqual({
      supported,
      requiredFiles: [],
    });
  });

  test.each([
    {
      label: "native manifest archive",
      files: [
        nativePath("Animals", "manifest.json"),
        nativePath("Animals", "Animals.dll"),
        nativePath("Animals", "locale", "manifest.json"),
        nativePath("Animals", "locale", "strings.json"),
      ],
    },
    {
      label: "backslash manifest archive",
      files: [
        "Animals\\manifest.json",
        "Animals\\Animals.dll",
        "Animals\\locale\\manifest.json",
        "Animals\\locale\\strings.json",
      ],
    },
  ])(
    "ignores locale manifests and installs the current payload for $label",
    async ({ files }) => {
      stardewInstallerMocks.parseManifest.mockResolvedValue(
        makeManifest("Animals"),
      );

      const result = await installStardewValley(
        createApi() as any,
        files,
        "/staging",
      );

      expect(stardewInstallerMocks.parseManifest).toHaveBeenCalledTimes(1);
      expect(
        normalizeFilesystemPath(
          stardewInstallerMocks.parseManifest.mock.calls[0]?.[0] as string,
        ),
      ).toBe("/staging/Animals/manifest.json");
      expect(normalizeInstallResult(result)).toEqual({
        instructions: [
          {
            type: "copy",
            source: "Animals/manifest.json",
            destination: "Animals/manifest.json",
          },
          {
            type: "copy",
            source: "Animals/Animals.dll",
            destination: "Animals/Animals.dll",
          },
          {
            type: "copy",
            source: "Animals/locale/manifest.json",
            destination: "Animals/locale/manifest.json",
          },
          {
            type: "copy",
            source: "Animals/locale/strings.json",
            destination: "Animals/locale/strings.json",
          },
        ],
      });
    },
  );

  test("warns for an invalid sibling manifest but still installs the valid one", async () => {
    const api = createApi();
    stardewInstallerMocks.parseManifest.mockImplementation(
      async (manifestPath: string) => {
        if (
          normalizeFilesystemPath(manifestPath) ===
          "/staging/Animals/manifest.json"
        ) {
          return makeManifest("Animals");
        }

        throw new Error("invalid manifest");
      },
    );

    const result = await installStardewValley(
      api as any,
      [
        nativePath("Animals", "manifest.json"),
        nativePath("Animals", "Animals.dll"),
        nativePath("Broken", "manifest.json"),
        nativePath("Broken", "Broken.dll"),
      ],
      "/staging",
    );

    expect(normalizeInstallResult(result)).toEqual({
      instructions: [
        {
          type: "copy",
          source: "Animals/manifest.json",
          destination: "Animals/manifest.json",
        },
        {
          type: "copy",
          source: "Animals/Animals.dll",
          destination: "Animals/Animals.dll",
        },
      ],
    });
    expect(stardewInstallerMocks.log).toHaveBeenCalledTimes(1);
    expect(stardewInstallerMocks.log.mock.calls[0]?.[0]).toBe("warn");
    expect(stardewInstallerMocks.log.mock.calls[0]?.[1]).toBe(
      "Failed to parse manifest",
    );
    expect(
      normalizeArchivePath(
        stardewInstallerMocks.log.mock.calls[0]?.[2]?.manifestFile as string,
      ),
    ).toBe("Broken/manifest.json");
    expect(stardewInstallerMocks.log.mock.calls[0]?.[2]?.error).toBe(
      "invalid manifest",
    );
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  test("shows an error notification when every manifest parse fails", async () => {
    const api = createApi();
    const parseError = new Error("invalid manifest");
    stardewInstallerMocks.parseManifest.mockRejectedValue(parseError);

    const result = await installStardewValley(
      api as any,
      [
        nativePath("Broken", "manifest.json"),
        nativePath("Broken", "Broken.dll"),
      ],
      "/staging",
    );

    expect(result.instructions).toEqual([]);
    expect(api.showErrorNotification).toHaveBeenCalledWith(
      expect.stringContaining("The mod manifest is invalid and can't be read"),
      parseError,
      { allowReport: false },
    );
  });

  test("keeps archive-root manifest installs in the current empty-instruction state", async () => {
    const api = createApi();
    stardewInstallerMocks.parseManifest.mockResolvedValue(
      makeManifest("RootPack"),
    );

    const result = await installStardewValley(
      api as any,
      ["manifest.json", "RootPack.dll"],
      "/staging",
    );

    expect(result.instructions).toEqual([]);
    expect(api.showErrorNotification).not.toHaveBeenCalled();
    expect(
      normalizeFilesystemPath(
        stardewInstallerMocks.parseManifest.mock.calls[0]?.[0] as string,
      ),
    ).toBe("/staging/manifest.json");
  });
});

function createApi() {
  return {
    showErrorNotification: vi.fn(),
  };
}

function makeManifest(name: string): ISDVModManifest {
  return {
    Name: name,
    Author: "Path Test",
    Version: "1.0.0",
    Description: `${name} description`,
    UniqueID: `PathTest.${name}`,
    EntryDll: `${name}.dll`,
    MinimumApiVersion: "4.0.0",
    UpdateKeys: [],
    Dependencies: [],
  };
}

function nativePath(...segments: string[]): string {
  return segments.join(path.sep);
}

function normalizeArchivePath(input: string): string {
  return input.replaceAll("\\", "/");
}

function normalizeFilesystemPath(input: string): string {
  const normalized = path.normalize(input).replaceAll("\\", "/");
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
}

function normalizeInstallResult(result: types.IInstallResult) {
  return {
    instructions: result.instructions.map((instruction) => {
      if (instruction.type !== "copy") {
        return instruction;
      }

      const copyInstruction = instruction as typeof instruction & {
        source: string;
        destination: string;
      };

      return {
        ...copyInstruction,
        source: normalizeArchivePath(copyInstruction.source),
        destination: normalizeArchivePath(copyInstruction.destination),
      };
    }),
  };
}
