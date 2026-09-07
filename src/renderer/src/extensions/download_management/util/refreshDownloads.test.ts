import { beforeEach, describe, expect, it, vi } from "vitest";

const DL_PATH = "D:\\Vortex Mods\\downloads";

// The download folder is the audit source, so each test states exactly what is
// on disk. `undefined` means the folder does not exist.
let onDisk: string[] | undefined;
// a non-ENOENT failure, to check it isn't mistaken for an absent folder
let readError: NodeJS.ErrnoException | undefined;
const created: string[] = [];

const enoent = () => Object.assign(new Error("ENOENT"), { code: "ENOENT" });

const stat = (target: string) => {
  if (target === DL_PATH) {
    return onDisk === undefined
      ? Promise.reject(enoent())
      : Promise.resolve({ isDirectory: () => true });
  }
  return Promise.resolve({ isDirectory: () => false });
};

vi.mock("../../../util/fs", () => ({
  ensureDirWritableAsync: vi.fn((dir: string) => {
    created.push(dir);
    onDisk = onDisk ?? [];
    return Promise.resolve();
  }),
  readdirAsync: vi.fn(() => {
    if (readError !== undefined) {
      return Promise.reject(readError);
    }
    return onDisk === undefined ? Promise.reject(enoent()) : Promise.resolve(onDisk);
  }),
  statAsync: vi.fn((target: string) => stat(target)),
  // folderIsMissing probes with the silent variant, so it has to answer too
  statSilentAsync: vi.fn((target: string) => stat(target)),
}));

vi.mock("../../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

import { VortexError } from "@vortex/shared";

import { refreshDownloads } from "./refreshDownloads";

const identity = (input: string) => input.toLowerCase();

function run(knownDLs: string[]) {
  const added: string[] = [];
  const removed: string[] = [];
  const elevationPrompts: number[] = [];
  return refreshDownloads(
    DL_PATH,
    knownDLs,
    identity,
    (name: string) => {
      added.push(name);
      return Promise.resolve();
    },
    (name: string) => {
      removed.push(name);
      return Promise.resolve();
    },
    () => {
      elevationPrompts.push(1);
      return Promise.resolve();
    },
  ).then(() => ({ added, removed, elevationPrompts }));
}

describe("refreshDownloads", () => {
  beforeEach(() => {
    onDisk = [];
    readError = undefined;
    created.length = 0;
  });

  it("registers an archive the database doesn't know", async () => {
    onDisk = ["SkyUI.7z", "USSEP.7z"];

    const { added, removed } = await run(["skyui.7z"]);

    expect(added).toEqual(["USSEP.7z"]);
    expect(removed).toEqual([]);
  });

  it("removes a record whose archive is gone", async () => {
    onDisk = ["SkyUI.7z"];

    const { added, removed } = await run(["skyui.7z", "deleted-by-hand.7z"]);

    expect(added).toEqual([]);
    expect(removed).toEqual(["deleted-by-hand.7z"]);
  });

  it("ignores files that aren't archives", async () => {
    onDisk = ["SkyUI.7z", "notes.txt", "meta.json"];

    const { added, removed } = await run(["skyui.7z"]);

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("refuses to reconcile when the download folder is missing", async () => {
    // creating it here would make every known download look deleted:
    // "unavailable" is not "empty".
    onDisk = undefined;

    const err = await run(["skyui.7z", "ussep.7z"]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VortexError);
    expect((err as VortexError).data).toMatchObject({ kind: "fs:not-found", path: DL_PATH });
    expect(created).toEqual([]);
  });

  it("creates the folder on first run, when nothing is known yet", async () => {
    onDisk = undefined;

    const { added, removed } = await run([]);

    expect(created).toEqual([DL_PATH]);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("keeps every record when the folder reads empty", async () => {
    // an existing but empty folder is the same signal by another route: a drive
    // remounted blank, or a path pointing somewhere new.
    onDisk = [];

    const { added, removed } = await run(["skyui.7z", "ussep.7z"]);

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("still asks for elevation before reading, so permissions can be fixed", async () => {
    onDisk = ["SkyUI.7z"];

    const { elevationPrompts } = await run(["skyui.7z"]);

    expect(created).toEqual([DL_PATH]);
    expect(elevationPrompts).toEqual([]);
  });

  it("surfaces a read failure that isn't a missing folder", async () => {
    readError = Object.assign(new Error("EPERM"), { code: "EPERM" });

    await expect(run([])).rejects.toThrow("EPERM");
  });
});
