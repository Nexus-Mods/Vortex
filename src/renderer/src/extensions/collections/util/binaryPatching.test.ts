import { mkdir, readFile, truncate, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { expect, onTestFinished, vi } from "vitest";

import { makeDownload, makeInstalledCollection, makeMod } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import { makeTempDir } from "../../../test-utils/tempDir";
import type { IMod } from "../../mod_management/types/IMod";
import { PATCHES_PATH } from "../constants";
import { applyPatches, scanForDiffs } from "./binaryPatching";

// node-7z shells out to a real 7z binary, so the archive listing is a stub
const archive = vi.hoisted(() => ({
  entries: [] as Array<{ name: string; attr: string; crc: string }>,
}));
vi.mock("node-7z", () => ({
  default: class {
    list = async (
      _archivePath: string,
      _options: unknown,
      onEntries: (entries: typeof archive.entries) => Promise<void>,
    ) => onEntries(archive.entries);
  },
}));

// the CRC32 of a file of 2 GiB of zero bytes
const TWO_GIB_ZEROS_CRC = "4DBDF21C";
const GAME_ID = "skyrimse";
const STAGED_FILE = "big.ba2";

// window.api.bsdiff forwards to the main process; the patch stub writes "patched" as the output
function stubBsdiff() {
  const bsdiff = {
    diff: vi.fn(async () => undefined),
    patch: vi.fn((_oldPath: string, outputPath: string) => writeFile(outputPath, "patched")),
  };
  vi.stubGlobal("api", { ...window.api, bsdiff });
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return bsdiff;
}

// stages STAGED_FILE in the mod as 2 GiB of zero bytes
async function stageTwoGiBFile(stagingPath: string, mod: IMod): Promise<string> {
  const filePath = path.join(stagingPath, mod.installationPath, STAGED_FILE);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, "");
  await truncate(filePath, 2 * 1024 * 1024 * 1024);
  return filePath;
}

test("finds no edits in a staged 2 GiB file that matches its archive", async ({ makeApi }) => {
  const stagingPath = await makeTempDir("binary-patching-");
  const mod = makeMod({ archiveId: "dl-1", installationPath: "mod-1" });
  await stageTwoGiBFile(stagingPath, mod);
  // 7z lists CRCs in lower case
  archive.entries = [{ name: STAGED_FILE, attr: "A", crc: TWO_GIB_ZEROS_CRC.toLowerCase() }];
  const bsdiff = stubBsdiff();

  const { api } = makeApi({
    mods: { [GAME_ID]: { [mod.id]: mod } },
    downloads: {
      [mod.archiveId]: makeDownload({ state: "finished", localPath: `${mod.installationPath}.7z` }),
    },
    installPath: { [GAME_ID]: stagingPath },
  });
  api.events.on(
    "simulate-installer",
    (
      _gameId: string,
      _archiveId: string,
      _options: unknown,
      onInstalled: (...args: unknown[]) => void,
    ) =>
      onInstalled(
        { instructions: [{ type: "copy", source: STAGED_FILE, destination: STAGED_FILE }] },
        stagingPath,
      ),
  );

  const patches = await scanForDiffs(
    api,
    GAME_ID,
    mod.id,
    path.join(stagingPath, "out"),
    () => undefined,
  );
  expect(patches).toEqual({});
  expect(bsdiff.diff).not.toHaveBeenCalled();
}, 60_000);

test("applies a collection patch to a staged 2 GiB file", async ({ makeApi }) => {
  const stagingPath = await makeTempDir("binary-patching-");
  const mod = makeMod({ installationPath: "mod-1" });
  const collection = makeInstalledCollection({ installationPath: "collection-1" });
  const stagedPath = await stageTwoGiBFile(stagingPath, mod);
  const patchPath = path.join(
    stagingPath,
    collection.installationPath,
    PATCHES_PATH,
    "Mod One",
    `${STAGED_FILE}.diff`,
  );
  await mkdir(path.dirname(patchPath), { recursive: true });
  await writeFile(patchPath, "");
  stubBsdiff();

  const { api, errorNotifications } = makeApi({
    mods: { [GAME_ID]: { [mod.id]: mod, [collection.id]: collection } },
    installPath: { [GAME_ID]: stagingPath },
  });

  await applyPatches(api, collection, GAME_ID, "Mod One", mod.id, {
    [STAGED_FILE]: TWO_GIB_ZEROS_CRC,
  });
  expect(errorNotifications).toEqual([]);
  expect(await readFile(stagedPath, "utf8")).toBe("patched");
}, 60_000);
