import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type * as Redux from "redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getVortexPath reads electron's userData dir, which isn't wired up in tests, so (like the
// download adapter suites) it's mocked. It points at a real temp dir here so the log copy,
// the staging tree and the cleanup all run against a real filesystem.
const paths = vi.hoisted(() => ({ root: "" }));
vi.mock("../../../util/getVortexPath", () => ({ default: () => paths.root }));

// node-7z shells out to a real 7z binary, so the archiver is a spy. The source loads it with a
// dynamic import precisely so this mock applies; a bare require() would bypass it.
const seven = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("node-7z", () => ({
  default: class {
    add = seven.add;
  },
}));

import type { IState } from "../../../types/IState";
import { UserCanceled } from "../../../util/CustomErrors";
import { INVALID_FILENAME_RE } from "../../../util/util";
import {
  buildBundleFilename,
  formatBundleTimestamp,
  isBundledLogFile,
  pickLatestCrashDumps,
  prepareSupportBundle,
} from "./prepareSupportBundle";

interface IStagedBundle {
  staging: string;
  logs: string[];
  /** Contents of the staged `vortex.log`, when there is one. */
  vortexLog: string | undefined;
  dumps: string[];
  state: Record<string, any>;
  manifest: Record<string, any>;
}

/** The staging tree is deleted the moment the archive is written, so grab it from inside `add`. */
async function snapshotStaging(entries: string[]): Promise<IStagedBundle> {
  const staging = path.dirname(entries[0]);
  const logs = (await readdir(path.join(staging, "logs"))).sort();
  return {
    staging,
    logs,
    vortexLog: logs.includes("vortex.log")
      ? await readFile(path.join(staging, "logs", "vortex.log"), "utf8")
      : undefined,
    dumps: (await readdir(path.join(staging, "dumps"))).sort(),
    state: JSON.parse(await readFile(path.join(staging, "state", "state.json"), "utf8")),
    manifest: JSON.parse(await readFile(path.join(staging, "bundle.json"), "utf8")),
  };
}

const CURRENT_LOG =
  '2026-09-15T07:19:31.257Z [DEBG] [RENDERER] starting download {"url":"https://cf-files.nexusmods.com/a.7z?expires=1&md5=t0k3n&user_id=2","dest":"C:\\\\Users\\\\bob\\\\Downloads"}\n';

/** Writes a dump with a given age so mtime ordering is deterministic. */
async function writeDump(relPath: string, ageSeconds: number): Promise<void> {
  const fullPath = path.join(paths.root, "temp", "dumps", relPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `dump ${relPath}`);
  const when = new Date(Date.now() - ageSeconds * 1000);
  await utimes(fullPath, when, when);
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function makeState(loggedIn: boolean = true): IState {
  return {
    settings: {
      interface: { language: "en" },
      mods: { installPath: { skyrimse: "C:\\Users\\bob\\Games\\Vortex Mods" } },
    },
    persistent: loggedIn ? { nexus: { userInfo: { name: "Ada Lovelace", userId: 42 } } } : {},
    app: { appVersion: "2.2.0" },
    user: { multiUser: false },
    session: {
      base: {},
      nexus: {
        loginId: "b8c0f2f4",
        oauthPending: "https://users.nexusmods.com/oauth/authorize?state=b8c0f2f4",
        lastUpdate: { skyrimse: 1 },
      },
    },
    confidential: { account: { nexus: { APIKey: "secret" } } },
  } as unknown as IState;
}

function makeStore(state: IState): Redux.Store<IState> {
  return { getState: () => state } as unknown as Redux.Store<IState>;
}

let staged: IStagedBundle | undefined;

beforeEach(async () => {
  paths.root = await mkdtemp(path.join(tmpdir(), "vortex-bundle-"));
  await writeFile(path.join(paths.root, "vortex.log"), CURRENT_LOG);
  await writeFile(path.join(paths.root, "vortex1.log"), "rotated log");
  await writeFile(path.join(paths.root, "network.log"), "network log");
  await writeFile(path.join(paths.root, "unrelated.log"), "not ours");

  staged = undefined;
  seven.add.mockReset();
  seven.add.mockImplementation(async (archive: string, entries: string[]) => {
    staged = await snapshotStaging(entries);
    await writeFile(archive, "");
    return { code: 0, errors: [] };
  });
});

afterEach(async () => {
  await rm(paths.root, { recursive: true, force: true });
});

describe("formatBundleTimestamp", () => {
  it("formats local time as YYYYMMDD-HHmmss with everything zero padded", () => {
    expect(formatBundleTimestamp(new Date(2026, 0, 5, 9, 3, 7))).toBe("20260105-090307");
    expect(formatBundleTimestamp(new Date(2026, 11, 31, 23, 59, 59))).toBe("20261231-235959");
  });
});

describe("buildBundleFilename", () => {
  const when = new Date(2026, 0, 5, 9, 3, 7);

  it("uses the nexus account name", () => {
    expect(buildBundleFilename("2.2.0", "Ada", when)).toBe(
      "vortex-support-bundle_2.2.0_Ada_20260105-090307.7z",
    );
  });

  it("falls back to anonymous when logged out", () => {
    expect(buildBundleFilename("2.2.0", undefined, when)).toBe(
      "vortex-support-bundle_2.2.0_anonymous_20260105-090307.7z",
    );
    expect(buildBundleFilename("2.2.0", "", when)).toContain("_anonymous_");
  });

  it("keeps a prerelease version intact", () => {
    expect(buildBundleFilename("2.2.0-beta.3", "Ada", when)).toBe(
      "vortex-support-bundle_2.2.0-beta.3_Ada_20260105-090307.7z",
    );
  });

  it("makes an awkward account name path safe and space free", () => {
    const name = buildBundleFilename("2.2.0", "sam / drow: the one", when);

    expect(name).not.toMatch(/\s/);
    // the invalid set is platform dependent, so ask util.ts rather than hard coding it
    expect(name.search(INVALID_FILENAME_RE)).toBe(-1);
    expect(name.endsWith(".7z")).toBe(true);
  });
});

describe("pickLatestCrashDumps", () => {
  it("returns the newest dumps first and no more than the limit", () => {
    const dumps = [
      { path: "old.dmp", mtimeMs: 100 },
      { path: "newest.dmp", mtimeMs: 400 },
      { path: "older.dmp", mtimeMs: 200 },
      { path: "new.dmp", mtimeMs: 300 },
    ];

    expect(pickLatestCrashDumps(dumps).map((dump) => dump.path)).toEqual([
      "newest.dmp",
      "new.dmp",
      "older.dmp",
    ]);
    expect(pickLatestCrashDumps(dumps, 1).map((dump) => dump.path)).toEqual(["newest.dmp"]);
  });
});

describe("isBundledLogFile", () => {
  it("takes the vortex logs and the network log", () => {
    expect(isBundledLogFile("vortex.log")).toBe(true);
    expect(isBundledLogFile("vortex4.log")).toBe(true);
    expect(isBundledLogFile("network.log")).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(isBundledLogFile("vortex10.log")).toBe(false);
    expect(isBundledLogFile("unrelated.log")).toBe(false);
    expect(isBundledLogFile("startup.log")).toBe(false);
  });
});

describe("prepareSupportBundle", () => {
  it("archives the logs, a scrubbed state export and a manifest", async () => {
    const bundle = await prepareSupportBundle(makeStore(makeState()));

    expect(seven.add).toHaveBeenCalledTimes(1);
    const [archive, entries, options] = seven.add.mock.calls[0];

    expect(archive).toBe(bundle.archivePath);
    expect(path.basename(archive)).toMatch(
      /^vortex-support-bundle_.+_Ada-Lovelace_\d{8}-\d{6}\.7z$/,
    );
    expect(options).toEqual({ mx: "9", ssw: true, raw: ["-m0=LZMA2"] });

    // the three entries go in separately so they land at the archive root
    const staging = staged!.staging;
    expect(entries).toEqual([
      path.join(staging, "logs"),
      path.join(staging, "state"),
      path.join(staging, "bundle.json"),
    ]);

    expect(staged!.logs).toEqual(["network.log", "vortex.log", "vortex1.log"]);
    // no dumps on disk, so no dumps folder in the archive either
    expect(staged!.dumps).toEqual([]);

    expect(Object.keys(staged!.state)).toEqual([
      "settings",
      "persistent",
      "app",
      "user",
      "session",
    ]);
    expect(staged!.state.confidential).toBeUndefined();
    expect(staged!.state.session.nexus.oauthPending).toBeUndefined();
    expect(staged!.state.session.nexus.loginId).toBeUndefined();
    expect(staged!.state.session.nexus.lastUpdate).toEqual({ skyrimse: 1 });

    expect(staged!.manifest).toMatchObject({
      schemaVersion: 1,
      nexusUsername: "Ada Lovelace",
      nexusUserId: 42,
      platform: process.platform,
      arch: process.arch,
      userPathHasNonAscii: false,
      files: ["logs/network.log", "logs/vortex.log", "logs/vortex1.log", "state/state.json"],
    });
    expect(Date.parse(staged!.manifest.createdAt)).not.toBeNaN();

    expect(await exists(staging)).toBe(false);
    expect(await exists(bundle.archivePath)).toBe(true);

    await bundle.cleanup();
    expect(await exists(bundle.archivePath)).toBe(false);
  });

  it("redacts usernames and signed download links in the logs and the state export", async () => {
    await prepareSupportBundle(makeStore(makeState()));

    expect(staged!.vortexLog).toBe(
      '2026-09-15T07:19:31.257Z [DEBG] [RENDERER] starting download {"url":"https://cf-files.nexusmods.com/a.7z?expires=1&md5=REDACTED&user_id=2","dest":"C:\\\\Users\\\\<USER>\\\\Downloads"}\n',
    );
    expect(staged!.state.settings.mods.installPath.skyrimse).toBe(
      "C:\\Users\\<USER>\\Games\\Vortex Mods",
    );
    // the placeholder stands in for the name; the rest of the export is untouched
    expect(staged!.state.persistent.nexus.userInfo.name).toBe("Ada Lovelace");
  });

  it("adds only the newest three crash dumps, wherever Crashpad put them", async () => {
    await writeDump("reports/oldest.dmp", 400);
    await writeDump("reports/third.dmp", 300);
    await writeDump("pending/second.dmp", 200);
    await writeDump("newest.dmp", 100);
    // not dumps, or dumps the startup sweep has claimed for itself
    await writeDump("settings.dat", 0);
    await writeDump("reports/claimed.dmp.claimed", 0);

    await prepareSupportBundle(makeStore(makeState()));

    expect(staged!.dumps).toEqual(["newest.dmp", "second.dmp", "third.dmp"]);

    const [, entries] = seven.add.mock.calls[0];
    expect(entries).toContain(path.join(staged!.staging, "dumps"));
    expect(staged!.manifest.files).toEqual([
      "logs/network.log",
      "logs/vortex.log",
      "logs/vortex1.log",
      "dumps/newest.dmp",
      "dumps/second.dmp",
      "dumps/third.dmp",
      "state/state.json",
    ]);
  });

  it("forwards 7-Zip progress", async () => {
    seven.add.mockImplementation(
      async (archive: string, entries: string[], _options: unknown, progress: any) => {
        staged = await snapshotStaging(entries);
        progress([], 37, undefined, vi.fn());
        await writeFile(archive, "");
        return { code: 0, errors: [] };
      },
    );

    const onProgress = vi.fn();
    await prepareSupportBundle(makeStore(makeState()), { onProgress });

    expect(onProgress).toHaveBeenCalledWith(37);
  });

  it("fails and cleans up when 7-Zip reports an error", async () => {
    let archivePath = "";
    seven.add.mockImplementation(async (archive: string, entries: string[]) => {
      archivePath = archive;
      staged = await snapshotStaging(entries);
      // 7-Zip writes to "<archive>.tmp" and only renames once it has succeeded
      await writeFile(`${archive}.tmp`, "partial");
      await writeFile(archive, "partial");
      return { code: 2, errors: ["boom"] };
    });

    await expect(prepareSupportBundle(makeStore(makeState()))).rejects.toThrow(/boom/);

    expect(await exists(archivePath)).toBe(false);
    expect(await exists(`${archivePath}.tmp`)).toBe(false);
    expect(await exists(staged!.staging)).toBe(false);
  });

  it("kills the archiver and cleans up when aborted mid run", async () => {
    const controller = new AbortController();
    let finishAdd: ((result: unknown) => void) | undefined;
    const cancel = vi.fn(() => finishAdd?.({ code: 255, errors: [] }));
    let archivePath = "";

    seven.add.mockImplementation(
      async (archive: string, entries: string[], _options: unknown, progress: any) => {
        archivePath = archive;
        staged = await snapshotStaging(entries);
        await writeFile(`${archive}.tmp`, "partial");
        progress([], 5, undefined, cancel);
        return new Promise((resolve) => {
          finishAdd = resolve;
        });
      },
    );

    const bundle = prepareSupportBundle(makeStore(makeState()), { signal: controller.signal });
    await vi.waitFor(() => expect(finishAdd).toBeDefined());

    controller.abort();

    await expect(bundle).rejects.toBeInstanceOf(UserCanceled);
    expect(cancel).toHaveBeenCalled();
    expect(await exists(`${archivePath}.tmp`)).toBe(false);
    expect(await exists(staged!.staging)).toBe(false);
  });

  it("does not start the archiver when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      prepareSupportBundle(makeStore(makeState()), { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UserCanceled);

    expect(seven.add).not.toHaveBeenCalled();
  });

  it("still builds a bundle when there is no vortex.log", async () => {
    await unlink(path.join(paths.root, "vortex.log"));
    await unlink(path.join(paths.root, "vortex1.log"));

    const bundle = await prepareSupportBundle(makeStore(makeState()));

    expect(staged!.logs).toEqual(["network.log"]);
    expect(staged!.manifest.files).toEqual(["logs/network.log", "state/state.json"]);
    expect(await exists(bundle.archivePath)).toBe(true);
  });

  it("names the bundle anonymous and leaves the manifest user blank when logged out", async () => {
    const bundle = await prepareSupportBundle(makeStore(makeState(false)));

    expect(path.basename(bundle.archivePath)).toMatch(
      /^vortex-support-bundle_.+_anonymous_\d{8}-\d{6}\.7z$/,
    );
    expect(staged!.manifest.nexusUsername).toBeUndefined();
    expect(staged!.manifest.nexusUserId).toBeUndefined();
  });
});
