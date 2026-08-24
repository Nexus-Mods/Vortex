import { beforeEach, describe, expect, it, vi } from "vitest";

// refreshMods reads the staging folder off disk. Drive it from an in-memory
// listing so each test can state exactly what the staging folder holds;
// a missing entry means the folder itself doesn't exist.
const stagingEntries = new Map<string, string[]>();
const createdDirs: string[] = [];

const enoent = () => Object.assign(new Error("ENOENT"), { code: "ENOENT" });

vi.mock("../../../util/fs", () => ({
  ensureDirAsync: vi.fn((dir: string) => {
    createdDirs.push(dir);
    if (!stagingEntries.has(dir)) {
      stagingEntries.set(dir, []);
    }
    return Promise.resolve();
  }),
  readdirAsync: vi.fn((dir: string) => {
    const entries = stagingEntries.get(dir);
    return entries === undefined ? Promise.reject(enoent()) : Promise.resolve(entries);
  }),
  statAsync: vi.fn((full: string) => {
    if (stagingEntries.has(full)) {
      return Promise.resolve({ isDirectory: () => true, ctime: new Date(0) });
    }
    const sep = Math.max(full.lastIndexOf("\\"), full.lastIndexOf("/"));
    const dir = full.slice(0, sep);
    const name = full.slice(sep + 1);
    return (stagingEntries.get(dir) ?? []).includes(name)
      ? Promise.resolve({ isDirectory: () => true, ctime: new Date(0) })
      : Promise.reject(enoent());
  }),
  removeAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

// only reached when the user declines the dialog; a real quit would kill the run
const quit = vi.fn();
vi.mock("../../../util/application", () => ({
  getApplication: () => ({ quit }),
}));

import { VortexError } from "@vortex/shared";

import { makeApiHarness, makeDownload, makeMod } from "../../../test-utils/builders";
import { removeMod } from "../actions/mods";
import type { IMod } from "../types/IMod";
import refreshMods from "./refreshMods";

const STAGING = "D:\\Vortex Mods\\skyrimse";
const GAME = "skyrimse";

/**
 * Drives refreshMods the way eventHandlers does: the staging folder holds
 * `onDisk`, state holds `knownMods`, and the user accepts the dialog. Removal
 * dispatches the real removeMod so the harness's real mods reducer applies it,
 * mirroring production rather than restating the outcome.
 */
function run(knownMods: Record<string, IMod>, onDisk: string[] | undefined, downloads = {}) {
  if (onDisk !== undefined) {
    stagingEntries.set(STAGING, onDisk);
  }
  const harness = makeApiHarness({ mods: { [GAME]: knownMods }, downloads });
  harness.setNextDialog({ action: "Apply Changes", input: {} });

  return refreshMods(
    harness.api,
    GAME,
    STAGING,
    knownMods,
    (mod: IMod) => harness.api.store.dispatch({ type: "ADD_MOD", payload: { gameId: GAME, mod } }),
    (modNames: string[]) => {
      modNames.forEach((name) => harness.api.store.dispatch(removeMod(GAME, name)));
    },
  ).then(() => harness);
}

describe("refreshMods", () => {
  beforeEach(() => {
    stagingEntries.clear();
    createdDirs.length = 0;
    quit.mockClear();
  });

  it("rebinds a mod whose archive reference went stale", async () => {
    const mods = {
      "Good Mod-1-0-0": makeMod({
        id: "Good Mod-1-0-0",
        installationPath: "Good Mod-1-0-0",
        archiveId: "goneId",
        attributes: { fileName: "GoodMod.7z" },
      }),
    };
    const downloads = { freshId: makeDownload({ id: "freshId", localPath: "GoodMod.7z" }) };

    const harness = await run(mods, ["Good Mod-1-0-0"], downloads);

    const mod = harness.getState().persistent.mods[GAME]["Good Mod-1-0-0"];
    expect(mod.archiveId).toBe("freshId");
    expect(mod.installationPath).toBe("Good Mod-1-0-0");
    expect(mod.state).toBe("installed");
  });

  it("leaves no record behind for a mod that vanished from the staging folder", async () => {
    // once removed the mod must stay removed: rebinding it to an archive
    // revives it as a record holding nothing but an archiveId.
    const mods = {
      "SkyUI_5_2_SE-12604-5-2SE": makeMod({
        id: "SkyUI_5_2_SE-12604-5-2SE",
        installationPath: "SkyUI_5_2_SE-12604-5-2SE",
        archiveId: "goneId",
        attributes: { fileName: "SkyUI.7z" },
      }),
    };
    const downloads = { freshId: makeDownload({ id: "freshId", localPath: "SkyUI.7z" }) };

    const harness = await run(mods, [], downloads);

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });

  it("refuses to reconcile when the staging folder is missing", async () => {
    // Creating it here would make every mod look deleted. A staging folder
    // that isn't there means unavailable (wrong drive, path not applied yet),
    // not emptied.
    const mods = {
      "SkyUI_5_2_SE-12604-5-2SE": makeMod({
        id: "SkyUI_5_2_SE-12604-5-2SE",
        installationPath: "SkyUI_5_2_SE-12604-5-2SE",
      }),
    };

    const err = await run(mods, undefined).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VortexError);
    expect((err as VortexError).data).toMatchObject({ kind: "fs:not-found", path: STAGING });
    expect(createdDirs).toEqual([]);
  });

  it("creates the staging folder on first run, when no mods are known", async () => {
    const harness = await run({}, undefined);

    expect(createdDirs).toEqual([STAGING]);
    expect(harness.dialogCalls).toEqual([]);
  });

  it("does not rebind an archive onto a mod it never knew", async () => {
    const harness = await run({}, [], {
      freshId: makeDownload({ id: "freshId", localPath: "SkyUI.7z" }),
    });

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });
});
