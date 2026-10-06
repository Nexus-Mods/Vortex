import * as path from "path";

import {
  ChaosFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type ChaosRule,
  type FileSystem,
} from "@vortex/shared/filesystem";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { installInMemoryFS } from "../test-utils/fsApi";
import { GameEntryNotFound } from "../types/IGameStore";
import { Steam } from "./Steam";

// Steam.ts builds its singleton at import time, and on Linux that constructor calls
// findLinuxSteamPath straight away - before any binding declared below this file's
// imports exists. vi.hoisted runs ahead of the imports, so the mocks can read it.
// (On Windows the equivalent RegGetValue call sits in a try/catch that swallows the
// ReferenceError, which is why a plain `let` only fails on CI.)
const steam = vi.hoisted(() => ({ installed: true, baseFolder: "C:\\Steam" }));

const BASE_FOLDER = steam.baseFolder;
const ALT_LIBRARY = path.join("D:", "SteamLibrary");
const THIRD_LIBRARY = path.join("E:", "Games");

const MANIFEST = `"AppState"
{
  "appid" "42"
  "name" "Test Game"
  "installdir" "TestGame"
  "LastOwner" "1"
  "LastUpdated" "0"
}`;

/** simple-vdf rejects inline braces, so every block needs its own lines. */
const vdf = (...lines: string[]): string => lines.join("\n");

/**
 * Steam escapes the separators, so JSON.stringify happens to produce exactly
 * the quoting a real file uses.
 */
const libraryFolders = (
  libPaths: string[],
  opts: { key?: string; firstIndex?: number } = {},
): string => {
  const { key = "libraryfolders", firstIndex = 1 } = opts;
  return vdf(
    `"${key}"`,
    "{",
    ...libPaths.flatMap((libPath, idx) => [
      `  "${idx + firstIndex}"`,
      "  {",
      `    "path"  ${JSON.stringify(libPath)}`,
      "  }",
    ]),
    "}",
  );
};

const gamePathIn = (library: string): string =>
  path.join(library, "steamapps", "common", "TestGame");

/** The libraryfolders.vdf contents to seed; tests set this before scanning. */
let libraryFoldersVdf = "";
/** Fault rules wrapped around the seeded FS; tests set these before scanning. */
let chaosRules: ChaosRule[] = [];

vi.mock("winapi-bindings", () => ({
  RegGetValue: () => {
    if (!steam.installed) {
      throw new Error("registry key not found");
    }
    return { value: steam.baseFolder };
  },
}));

vi.mock("./linux/steamPaths", () => ({
  findLinuxSteamPath: () => (steam.installed ? steam.baseFolder : undefined),
}));

vi.mock("./linux/proton", () => ({
  getProtonInfo: () => Promise.resolve({ usesProton: false }),
  buildProtonEnvironment: () => ({}),
  buildProtonCommand: () => ({ executable: "", args: [] }),
}));

/**
 * Seeds an in-memory FS behind window.api.fs: the libraryfolders.vdf plus one
 * appmanifest per known library, then wraps it in ChaosFS so tests can inject
 * parseError-classifiable faults.
 */
const installTestFS = (): (() => void) => {
  const { fs, restore } = installInMemoryFS((builder) => {
    builder.file(QualifiedPath.fromNative(path.join(BASE_FOLDER, "config", "libraryfolders.vdf")), {
      type: "text",
      data: libraryFoldersVdf,
    });

    for (const library of [BASE_FOLDER, ALT_LIBRARY, THIRD_LIBRARY]) {
      builder.file(
        QualifiedPath.fromNative(path.join(library, "steamapps", "appmanifest_42.acf")),
        {
          type: "text",
          data: MANIFEST,
        },
      );
    }
  });

  (window as unknown as { api?: { fs?: FileSystem } }).api!.fs = new ChaosFS(fs, chaosRules);
  return restore;
};

/**
 * Drive the manager-owned scan, then read the data through allGames -
 * allGames itself no longer triggers a parse.
 */
const scanAllGames = async () => {
  const restore = installTestFS();
  try {
    const store = new Steam();
    await store.reloadGames();
    return store.allGames();
  } finally {
    restore();
  }
};

describe("Steam.allGames", () => {
  beforeEach(() => {
    steam.installed = true;
    chaosRules = [];
    libraryFoldersVdf = libraryFolders([]);
  });

  it("finds nothing when Steam isn't installed", async () => {
    steam.installed = false;

    await expect(scanAllGames()).resolves.toEqual([]);
  });

  it.each(["fs:not-found", "fs:no-permissions"] satisfies ChaosRule["fault"]["kind"][])(
    "falls back to the base folder on %s",
    async (kind) => {
      chaosRules = [
        {
          fault: { kind },
          op: "readFile",
          path: (p) => p.value.includes("libraryfolders.vdf"),
        },
      ];

      const entries = await scanAllGames();

      expect(entries.map((entry) => entry.gamePath)).toEqual([gamePathIn(BASE_FOLDER)]);
    },
  );

  it("propagates errors other than not-found/no-permissions", async () => {
    chaosRules = [
      {
        fault: {
          kind: "os:generic",
          originalCode: "EIO",
          message: "EIO: i/o error, read 'libraryfolders.vdf'",
        },
        op: "readFile",
        path: (p) => p.value.includes("libraryfolders.vdf"),
      },
    ];

    const restore = installTestFS();
    try {
      await expect(new Steam().reloadGames()).rejects.toThrow("EIO");
    } finally {
      restore();
    }
  });

  it.each([
    ["an empty file", ""],
    ["no libraryfolders key", vdf('"something else"', "{", "}")],
    ["libraryfolders holding a leaf value", vdf('"libraryfolders"  "nonsense"')],
    ["an entry holding a leaf value", vdf('"libraryfolders"', "{", '  "1"  "nonsense"', "}")],
    [
      "an entry whose path is a block",
      vdf(
        '"libraryfolders"',
        "{",
        '  "1"',
        "  {",
        '    "path"',
        "    {",
        '      "nested"  "value"',
        "    }",
        "  }",
        "}",
      ),
    ],
  ])("falls back to the base folder given %s", async (_label, contents) => {
    libraryFoldersVdf = contents;

    const entries = await scanAllGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([gamePathIn(BASE_FOLDER)]);
  });

  it("scans the alternate libraries listed in libraryfolders.vdf", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY]);

    const entries = await scanAllGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });

  it("matches the libraryfolders key case-insensitively", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY], { key: "LibraryFolders" });

    const entries = await scanAllGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });

  it("reads libraries numbered from zero", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY, THIRD_LIBRARY], { firstIndex: 0 });

    const entries = await scanAllGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
      gamePathIn(THIRD_LIBRARY),
    ]);
  });

  it("stops at the first gap in the numbering", async () => {
    libraryFoldersVdf = vdf(
      '"libraryfolders"',
      "{",
      '  "0"',
      "  {",
      `    "path"  ${JSON.stringify(ALT_LIBRARY)}`,
      "  }",
      '  "2"',
      "  {",
      `    "path"  ${JSON.stringify(THIRD_LIBRARY)}`,
      "  }",
      "}",
    );

    const entries = await scanAllGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });
});
