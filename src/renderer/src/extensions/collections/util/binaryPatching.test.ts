import * as path from "path";

import * as crc32 from "crc-32";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type * as selectorsModule from "../../../util/selectors";

const mocks = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  // error codes reading these paths fails with, other than ENOENT for a missing file
  readErrors: new Map<string, string>(),
  archiveEntries: [] as Array<{ name: string; attr: string; crc: string }>,
  diffFiles: vi.fn(),
}));

vi.mock("../../../logging", () => ({ log: vi.fn() }));

vi.mock("../../../util/fs", () => ({
  readFileAsync: vi.fn(async (filePath: string) => {
    const code = mocks.readErrors.get(filePath);
    if (code !== undefined) {
      throw Object.assign(new Error(`${code}: ${filePath}`), { code });
    }
    const content = mocks.files.get(filePath);
    if (content === undefined) {
      throw Object.assign(new Error(`ENOENT: ${filePath}`), { code: "ENOENT" });
    }
    return content;
  }),
  // a small patch for a large file, so validatePatch accepts it
  statAsync: vi.fn(async (filePath: string) => ({
    size: filePath.endsWith(".diff") ? 10 : 100000,
  })),
  ensureDirWritableAsync: vi.fn(async () => undefined),
  removeAsync: vi.fn(async () => undefined),
}));

vi.mock("../../../util/selectors", async (importOriginal) => ({
  ...(await importOriginal<typeof selectorsModule>()),
  installPathForGame: () => "/staging",
  downloadPathForGame: () => "/downloads",
  knownGames: () => [],
}));

vi.mock("node-7z", () => ({
  default: class {
    async list(_archivePath: string, _options: unknown, cb: (entries: unknown[]) => unknown) {
      await cb(mocks.archiveEntries);
    }
  },
}));

vi.mock("./bsdiff", () => ({
  diffFiles: mocks.diffFiles,
  patchFiles: vi.fn(),
}));

import { scanForDiffs } from "./binaryPatching";

const crcOf = (content: string) =>
  (crc32.buf(Buffer.from(content)) >>> 0).toString(16).toUpperCase().padStart(8, "0");

function makeApi(instructions: Array<{ type: string; source: string; destination: string }>) {
  const state = {
    persistent: {
      mods: {
        fallout4: {
          mod1: {
            id: "mod1",
            installationPath: "mod1",
            archiveId: "archive1",
            attributes: {},
          },
        },
      },
      downloads: {
        files: { archive1: { game: ["fallout4"], localPath: "mod1.7z" } },
      },
    },
  };
  return {
    getState: () => state,
    translate: (text: string) => text,
    showErrorNotification: vi.fn(),
    showDialog: vi.fn(),
    events: {
      emit: vi.fn(
        (
          _event: string,
          _gameId: string,
          _archiveId: string,
          _options: unknown,
          cb: (result: unknown, tempPath: string) => unknown,
        ) => cb({ instructions }, "/temp"),
      ),
    },
  } as unknown as IExtensionApi;
}

describe("scanForDiffs", () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.readErrors.clear();
    mocks.diffFiles.mockReset();
    mocks.diffFiles.mockResolvedValue(undefined);
  });

  it("patches edited files and skips files the curator removed from staging", async () => {
    mocks.archiveEntries = [
      { name: "Edited.ini", attr: "", crc: crcOf("original") },
      { name: "Removed.esp", attr: "", crc: crcOf("plugin") },
    ];
    mocks.files.set(path.join("/staging", "mod1", "Edited.ini"), Buffer.from("edited"));
    // Removed.esp is in the archive but no longer in the staging folder

    const api = makeApi([
      { type: "copy", source: "Edited.ini", destination: "Edited.ini" },
      { type: "copy", source: "Removed.esp", destination: "Removed.esp" },
    ]);

    const patches = await scanForDiffs(api, "fallout4", "mod1", "/patches", () => undefined);

    expect(patches).toEqual({ "Edited.ini": crcOf("original") });
    expect(mocks.diffFiles).toHaveBeenCalledTimes(1);
    expect(mocks.diffFiles).toHaveBeenCalledWith(
      path.join("/temp", "Edited.ini"),
      path.join("/staging", "mod1", "Edited.ini"),
      path.join("/patches", "Edited.ini.diff"),
    );
  });

  it("still fails on errors other than a missing file", async () => {
    mocks.archiveEntries = [{ name: "Locked.ini", attr: "", crc: crcOf("original") }];
    mocks.readErrors.set(path.join("/staging", "mod1", "Locked.ini"), "EPERM");

    const api = makeApi([{ type: "copy", source: "Locked.ini", destination: "Locked.ini" }]);

    await expect(
      scanForDiffs(api, "fallout4", "mod1", "/patches", () => undefined),
    ).rejects.toThrow("EPERM");
  });

  it("fails when none of the mod's files are in its staging folder", async () => {
    // not a curator's deletion but a staging folder that doesn't match the installer's layout
    mocks.archiveEntries = [
      { name: "A.ini", attr: "", crc: crcOf("a") },
      { name: "B.esp", attr: "", crc: crcOf("b") },
    ];

    const api = makeApi([
      { type: "copy", source: "A.ini", destination: "A.ini" },
      { type: "copy", source: "B.esp", destination: "B.esp" },
    ]);

    await expect(
      scanForDiffs(api, "fallout4", "mod1", "/patches", () => undefined),
    ).rejects.toThrow();
    expect(mocks.diffFiles).not.toHaveBeenCalled();
  });
});
