import * as path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { Steam } from "./Steam";

const BASE_FOLDER = path.join("C:", "Steam");
const ALT_LIBRARY = path.join("D:", "SteamLibrary");
const THIRD_LIBRARY = path.join("E:", "Games");
const LIB_FOLDERS_FILE = path.resolve(BASE_FOLDER, "config", "libraryfolders.vdf");

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

let steamInstalled = true;
let libraryFoldersError: NodeJS.ErrnoException | undefined;
let libraryFoldersVdf = "";

vi.mock("winapi-bindings", () => ({
  RegGetValue: () => {
    if (!steamInstalled) {
      throw new Error("registry key not found");
    }
    return { value: BASE_FOLDER };
  },
}));

vi.mock("./linux/steamPaths", () => ({
  findLinuxSteamPath: () => (steamInstalled ? BASE_FOLDER : undefined),
}));

vi.mock("./linux/proton", () => ({
  getProtonInfo: () => Promise.resolve({ usesProton: false }),
  buildProtonEnvironment: () => ({}),
  buildProtonCommand: () => ({ executable: "", args: [] }),
}));

vi.mock("fs/promises", () => ({
  readdir: () => Promise.resolve(["appmanifest_42.acf"]),
  readFile: () =>
    libraryFoldersError !== undefined
      ? Promise.reject(libraryFoldersError)
      : Promise.resolve(Buffer.from(libraryFoldersVdf)),
}));

vi.mock("./fs", () => ({
  readFileAsync: () => Promise.resolve(Buffer.from(MANIFEST)),
}));

const fsError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`${code}: no such file or directory, open '${LIB_FOLDERS_FILE}'`), {
    code,
    path: LIB_FOLDERS_FILE,
  });

describe("Steam.allGames", () => {
  beforeEach(() => {
    steamInstalled = true;
    libraryFoldersError = undefined;
    libraryFoldersVdf = libraryFolders([]);
  });

  it("finds nothing when Steam isn't installed", async () => {
    steamInstalled = false;

    await expect(new Steam().allGames()).resolves.toEqual([]);
  });

  it.each(["ENOENT", "EPERM"])("falls back to the base folder on %s", async (code) => {
    libraryFoldersError = fsError(code);

    const entries = await new Steam().allGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([gamePathIn(BASE_FOLDER)]);
  });

  it("propagates errors other than ENOENT/EPERM", async () => {
    libraryFoldersError = fsError("EIO");

    await expect(new Steam().allGames()).rejects.toThrow("EIO");
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

    const entries = await new Steam().allGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([gamePathIn(BASE_FOLDER)]);
  });

  it("scans the alternate libraries listed in libraryfolders.vdf", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY]);

    const entries = await new Steam().allGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });

  it("matches the libraryfolders key case-insensitively", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY], { key: "LibraryFolders" });

    const entries = await new Steam().allGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });

  it("reads libraries numbered from zero", async () => {
    libraryFoldersVdf = libraryFolders([ALT_LIBRARY, THIRD_LIBRARY], { firstIndex: 0 });

    const entries = await new Steam().allGames();

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

    const entries = await new Steam().allGames();

    expect(entries.map((entry) => entry.gamePath)).toEqual([
      gamePathIn(BASE_FOLDER),
      gamePathIn(ALT_LIBRARY),
    ]);
  });
});
