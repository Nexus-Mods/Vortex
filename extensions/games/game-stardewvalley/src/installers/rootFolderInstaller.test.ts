/**
 * Tests the minimal root-folder installer regression cases.
 */
import path from "path";
import { describe, expect, test } from "vitest";
import type { types } from "vortex-api";

import { GAME_ID } from "../common";
import { installRootFolder, testRootFolder } from "./rootFolderInstaller";

const nativeRootFolderArchive = [
  nativeDirectory("SomePack", "Content"),
  nativePath("SomePack", "Content", "Data.xnb"),
  nativePath("SomePack", "Mods", "Helper", "manifest.json"),
  nativePath("SomePack", "README.txt"),
  nativePath("SomePack", "README.TXT"),
];

describe("installers/rootFolderInstaller", () => {
  test("claims native root-folder archives", async () => {
    await expect(
      testRootFolder(nativeRootFolderArchive, GAME_ID),
    ).resolves.toEqual({
      supported: true,
      requiredFiles: [],
    });
  });

  test("keeps the current host-sensitive backslash matcher behavior", async () => {
    await expect(
      testRootFolder(
        ["SomePack\\Content\\", "SomePack\\Content\\Data.xnb"],
        GAME_ID,
      ),
    ).resolves.toEqual({
      supported: path.sep === "\\",
      requiredFiles: [],
    });
  });

  test.each([
    {
      label: "wrong game id",
      files: nativeRootFolderArchive,
      gameId: "skyrim",
    },
    {
      label: "missing Content directory entry",
      files: [
        nativePath("SomePack", "Content", "Data.xnb"),
        nativePath("SomePack", "Mods", "Helper", "manifest.json"),
      ],
      gameId: GAME_ID,
    },
  ])("does not claim archives for $label", async ({ files, gameId }) => {
    await expect(testRootFolder(files, gameId)).resolves.toEqual({
      supported: false,
      requiredFiles: [],
    });
  });

  test("returns no instructions when the archive lacks a root Content marker", async () => {
    await expect(
      installRootFolder(
        [nativePath("SomePack", "Content", "Data.xnb")],
        "/staging",
      ),
    ).resolves.toEqual({ instructions: [] });
  });

  test("strips the root folder, keeps sibling folders, and filters only lowercase .txt files", async () => {
    const result = await installRootFolder(nativeRootFolderArchive, "/staging");

    expect(normalizeInstallResult(result)).toEqual({
      instructions: [
        {
          type: "copy",
          source: "SomePack/Content/Data.xnb",
          destination: "Content/Data.xnb",
        },
        {
          type: "copy",
          source: "SomePack/Mods/Helper/manifest.json",
          destination: "Mods/Helper/manifest.json",
        },
        {
          type: "copy",
          source: "SomePack/README.TXT",
          destination: "README.TXT",
        },
      ],
    });
  });

  test("keeps the current host-sensitive backslash install behavior", async () => {
    const result = await installRootFolder(
      nativeRootFolderArchive.map((file) => file.replaceAll(path.sep, "\\")),
      "/staging",
    );

    expect(normalizeInstallResult(result)).toEqual({
      instructions:
        path.sep === "\\"
          ? [
              {
                type: "copy",
                source: "SomePack/Content/Data.xnb",
                destination: "Content/Data.xnb",
              },
              {
                type: "copy",
                source: "SomePack/Mods/Helper/manifest.json",
                destination: "Mods/Helper/manifest.json",
              },
              {
                type: "copy",
                source: "SomePack/README.TXT",
                destination: "README.TXT",
              },
            ]
          : [],
    });
  });
});

function nativePath(...segments: string[]): string {
  return segments.join(path.sep);
}

function nativeDirectory(...segments: string[]): string {
  return `${nativePath(...segments)}${path.sep}`;
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

function normalizeArchivePath(input: string): string {
  return input.replaceAll("\\", "/");
}
