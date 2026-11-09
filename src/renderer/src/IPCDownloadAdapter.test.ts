import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { AlreadyDownloaded } from "@vortex/shared/errors";
import type { WireDownloadCheckpoint } from "@vortex/shared/ipc";
import { describe, expect, it, vi } from "vitest";

import { clearDownloadCheckpoint } from "./actions/downloads";
import {
  downloadProgress,
  finishDownload,
  pauseDownload,
} from "./extensions/download_management/actions/state";
import type { IGameStored } from "./extensions/gamemode_management/types/IGameStored";
import { expandCompatibleGameIds, isResumableCheckpoint } from "./IPCDownloadAdapter";
import { test } from "./test-utils/downloadAdapterTest";
import type { IDownloadAdapterHarness, IDownloadAdapterOpts } from "./test-utils/harnessTypes";
import { makeTempDir } from "./test-utils/tempDir";

// getDownloadPath reads electron's userData dir via ApplicationData, which isn't initialized in the
// test env; the harness computes the same dest through this stub so start()'s dest still matches.
vi.mock("./util/getVortexPath", () => ({ default: () => "/vortex-userdata" }));

function game(id: string, compatibleDownloads?: string[]): IGameStored {
  return {
    id,
    name: id,
    requiredFiles: [],
    executable: `${id}.exe`,
    ...(compatibleDownloads !== undefined ? { details: { compatibleDownloads } } : {}),
  };
}

describe("expandCompatibleGameIds", () => {
  // Skyrim VR borrows skyrimse downloads via `details.compatibleDownloads`.
  const skyrimse = game("skyrimse");
  const skyrimvr = game("skyrimvr", ["skyrimse"]);
  const fallout4 = game("fallout4", ["fallout4london"]);
  const games = [skyrimse, skyrimvr, fallout4];

  it("appends games that declare the download's game as a compatible source", () => {
    // A skyrimse-domain download, while skyrimvr is one of the managed games,
    // must list skyrimvr so the install handler can target it (APP-506).
    expect(expandCompatibleGameIds(games, "skyrimse")).toEqual(["skyrimse", "skyrimvr"]);
  });

  it("keeps the download's own game id first for path resolution", () => {
    // download.game[0] drives the on-disk download path, so the base id must stay first.
    expect(expandCompatibleGameIds(games, "skyrimse")[0]).toBe("skyrimse");
  });

  it("returns only the game id when nothing declares it compatible", () => {
    expect(expandCompatibleGameIds(games, "fallout4")).toEqual(["fallout4"]);
  });

  it("ignores games whose details/compatibleDownloads are absent", () => {
    expect(expandCompatibleGameIds([skyrimse, game("oblivion")], "skyrimse")).toEqual(["skyrimse"]);
  });

  it("dedupes if the source game also declares itself compatible", () => {
    const selfRef = game("xcom2", ["xcom2"]);
    expect(expandCompatibleGameIds([selfRef], "xcom2")).toEqual(["xcom2"]);
  });

  it("matches multiple borrowing games", () => {
    const skyrimvrAlt = game("skyrimvr-alt", ["skyrimse"]);
    expect(expandCompatibleGameIds([...games, skyrimvrAlt], "skyrimse")).toEqual([
      "skyrimse",
      "skyrimvr",
      "skyrimvr-alt",
    ]);
  });

  it("preserves the undefined id (no managed game) as the sole entry", () => {
    expect(expandCompatibleGameIds(games, undefined)).toEqual([undefined]);
  });
});

function checkpoint(
  completedRanges: Array<{ start: number; end: number }>,
): WireDownloadCheckpoint {
  return {
    downloadId: "dl",
    resource: "https://cdn.example/file",
    dest: "d",
    completedRanges,
    etag: undefined,
  };
}

describe("isResumableCheckpoint", () => {
  it("is not resumable without a checkpoint (interrupted rather than cleanly paused)", () => {
    expect(isResumableCheckpoint(undefined)).toBe(false);
  });

  it("is not resumable when no byte range completed (paused before the first chunk)", () => {
    expect(isResumableCheckpoint(checkpoint([]))).toBe(false);
  });

  it("is resumable once at least one range completed", () => {
    expect(isResumableCheckpoint(checkpoint([{ start: 0, end: 1023 }]))).toBe(true);
  });
});

function wireState(status: string, bytesReceived: number) {
  return { status, error: null, bytesReceived, size: 100, fileName: undefined, isChunked: false };
}

describe("runtime restore", () => {
  test("restores a checkpointless paused download under the same id", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({ download: { state: "paused" } });

    h.events.emit("resume-download", h.downloadId, () => undefined);
    await h.started.promise;

    // restarted under the SAME id, not resumed
    expect(h.resume).not.toHaveBeenCalled();
    expect(h.start).toHaveBeenCalledWith(h.dest, expect.any(Number), h.downloadId);

    // the record is reset to zero and returned to its active state (no urls, so the record's stored
    // source url is left untouched)
    expect(h.dispatched).toContainEqual(downloadProgress(h.downloadId, 0, 100, undefined));
    expect(h.dispatched).toContainEqual(pauseDownload(h.downloadId, false));
    expect(h.dispatched).toContainEqual(clearDownloadCheckpoint(h.downloadId));
  });

  test("restores when the checkpoint has no completed ranges", async ({ makeDownloadAdapter }) => {
    const h = makeDownloadAdapter({
      download: { state: "paused" },
      checkpoint: {
        downloadId: "",
        resource: "https://cdn.example/file.bin",
        dest: "d",
        completedRanges: [],
        etag: undefined,
      },
    });

    h.events.emit("resume-download", h.downloadId, () => undefined);
    await h.started.promise;

    expect(h.resume).not.toHaveBeenCalled();
    expect(h.start).toHaveBeenCalledWith(h.dest, expect.any(Number), h.downloadId);
  });

  test("resumes normally when the checkpoint has completed ranges", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({
      download: { state: "paused" },
      checkpoint: {
        downloadId: "",
        resource: "https://cdn.example/file.bin",
        dest: "d",
        completedRanges: [{ start: 0, end: 1023 }],
        etag: "etag-1",
      },
    });

    const resumed = new Promise<void>((resolve) => {
      h.events.emit("resume-download", h.downloadId, () => resolve());
    });
    await resumed;

    // usable checkpoint -> resume, not restart
    expect(h.resume).toHaveBeenCalledWith(
      expect.objectContaining({ completedRanges: [{ start: 0, end: 1023 }] }),
    );
    expect(h.start).not.toHaveBeenCalled();
  });

  test("reconstructs the nxm source url when the stored urls were wiped", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({
      download: {
        state: "paused",
        urls: [],
        modInfo: { nexus: { ids: { gameId: "skyrimse", modId: 123, fileId: 456 } } },
      },
    });

    const nxmHandler = vi
      .fn()
      .mockResolvedValue({ urls: ["https://cdn.example/resolved"], meta: {} });
    h.adapter.registerProtocol("nxm", nxmHandler);

    h.events.emit("resume-download", h.downloadId, () => undefined);
    await h.started.promise;

    // the rebuilt nxm url is resolved through the normal protocol flow
    expect(nxmHandler).toHaveBeenCalledWith("nxm://skyrimse/mods/123/files/456");
    // and healed back onto the record
    expect(h.dispatched).toContainEqual(
      downloadProgress(h.downloadId, 0, 100, ["nxm://skyrimse/mods/123/files/456"]),
    );
    expect(h.start).toHaveBeenCalledWith(h.dest, expect.any(Number), h.downloadId);
  });

  test("honors allowInstall: false from the resume options (no auto-install on completion)", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({ download: { state: "paused" }, automationInstall: true });
    const installSpy = vi.fn();
    h.events.on("start-install-download", installSpy);
    const finished = new Promise<void>((resolve) =>
      h.events.on("did-finish-download", () => resolve()),
    );

    h.events.emit("resume-download", h.downloadId, () => undefined, { allowInstall: false });
    await h.started.promise;

    h.getStates.mockResolvedValue({ [h.downloadId]: wireState("completed", 100) });
    await vi.advanceTimersByTimeAsync(250);
    await finished;

    expect(installSpy).not.toHaveBeenCalled();
  });

  test("auto-installs a restored download when automation is on and no override is given", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({ download: { state: "paused" }, automationInstall: true });
    const installed = new Promise<void>((resolve) =>
      h.events.on("start-install-download", () => resolve()),
    );

    h.events.emit("resume-download", h.downloadId, () => undefined);
    await h.started.promise;

    h.getStates.mockResolvedValue({ [h.downloadId]: wireState("completed", 100) });
    await vi.advanceTimersByTimeAsync(250);

    // resolves only when start-install-download fires
    await installed;
  });

  test("marks the record failed if the restart cannot be started", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter({ download: { state: "paused" } });
    h.start.mockRejectedValueOnce(new Error("resolve failed"));

    const err = await new Promise<Error | null>((resolve) => {
      h.events.emit("resume-download", h.downloadId, (e: Error | null) => resolve(e));
    });

    // the caller gets the error (not left hanging) and the record is marked failed rather than
    // stuck in an active state the poll never tracks
    expect(err).toBeInstanceOf(Error);
    expect(h.dispatched).toContainEqual(finishDownload(h.downloadId, "failed", expect.anything()));
  });
});

describe("duplicate archives", () => {
  const nexusIds = { nexus: { ids: { modId: 1, fileId: 2 } } };

  // a harness whose seeded download dl-0 is a finished "file.bin" in a real temp download folder,
  // optionally tracked by a second record dl-1 as well
  async function setup(
    makeDownloadAdapter: (opts?: IDownloadAdapterOpts) => IDownloadAdapterHarness,
    opts: { sharedWith?: boolean; modInfo?: Record<string, unknown> } = {},
  ) {
    const root = await makeTempDir("vortex-dl-");
    const h = makeDownloadAdapter({
      download: { state: "finished", modInfo: opts.modInfo ?? {} },
    });
    h.setState((draft) => {
      draft.settings.downloads.path = root;
      if (opts.sharedWith) {
        draft.persistent.downloads.files["dl-1"] = {
          ...draft.persistent.downloads.files["dl-0"],
          id: "dl-1",
        };
      }
    });
    const dlPath = path.join(root, "skyrimse");
    await mkdir(dlPath, { recursive: true });
    await writeFile(path.join(dlPath, "file.bin"), "original");
    return { h, dlPath };
  }

  // start a download, let main "write" it under its temp name, and complete it as fileName
  async function download(
    h: IDownloadAdapterHarness,
    redownload: string | undefined,
    modInfo: Record<string, unknown> = {},
  ): Promise<{ err: unknown; id?: string }> {
    const done = new Promise<{ err: unknown; id?: string }>((resolve) => {
      h.events.emit(
        "start-download",
        ["https://cdn.example/file.bin"],
        { game: "skyrimse", ...modInfo },
        "Display Name",
        (err: unknown, id?: string) => resolve({ err, id }),
        redownload,
      );
    });
    await h.started.promise;
    await vi.advanceTimersByTimeAsync(0);
    const [tempPath] = h.start.mock.calls[0] as [string];
    await writeFile(tempPath, "fresh");
    h.getStates.mockResolvedValue({
      "new-0": { ...wireState("completed", 100), fileName: "file.bin" },
    });
    await vi.advanceTimersByTimeAsync(250);
    return done;
  }

  test("removing one of two records sharing an archive keeps the file", async ({
    makeDownloadAdapter,
  }) => {
    const { h, dlPath } = await setup(makeDownloadAdapter, { sharedWith: true });
    const remove = (id: string) =>
      new Promise<void>((resolve) => h.events.emit("remove-download", id, () => resolve()));

    await remove("dl-0");
    expect(h.getState().persistent.downloads.files["dl-0"]).toBeUndefined();
    await expect(readFile(path.join(dlPath, "file.bin"), "utf8")).resolves.toBe("original");

    await remove("dl-1");
    await expect(access(path.join(dlPath, "file.bin"))).rejects.toThrow();
  });

  test("reuses a finished download of the same Nexus file without downloading", async ({
    makeDownloadAdapter,
  }) => {
    const { h } = await setup(makeDownloadAdapter, { modInfo: nexusIds });

    const err = await new Promise<unknown>((resolve) => {
      h.events.emit(
        "start-download",
        ["nxm://skyrimse/mods/1/files/2"],
        { game: "skyrimse", ...nexusIds },
        "Display Name",
        (e: unknown) => resolve(e),
      );
    });

    expect(err).toBeInstanceOf(AlreadyDownloaded);
    expect((err as AlreadyDownloaded).downloadId).toBe("dl-0");
    expect(h.start).not.toHaveBeenCalled();
  });

  test("a completed download named like a tracked archive reuses that record", async ({
    makeDownloadAdapter,
  }) => {
    const { h, dlPath } = await setup(makeDownloadAdapter);

    const { err } = await download(h, undefined);

    expect(err).toBeInstanceOf(AlreadyDownloaded);
    expect((err as AlreadyDownloaded).downloadId).toBe("dl-0");
    expect(h.getState().persistent.downloads.files["new-0"]).toBeUndefined();
    expect(await readdir(dlPath)).toEqual(["file.bin"]);
    await expect(readFile(path.join(dlPath, "file.bin"), "utf8")).resolves.toBe("original");
  });

  test("replace overwrites the archive under the record that tracks it", async ({
    makeDownloadAdapter,
  }) => {
    const { h, dlPath } = await setup(makeDownloadAdapter);

    const { err, id } = await download(h, "replace");

    expect(err).toBeNull();
    expect(id).toBe("dl-0");
    expect(h.getState().persistent.downloads.files["new-0"]).toBeUndefined();
    expect(await readdir(dlPath)).toEqual(["file.bin"]);
    await expect(readFile(path.join(dlPath, "file.bin"), "utf8")).resolves.toBe("fresh");
  });

  test("always keeps a separate copy under a free name", async ({ makeDownloadAdapter }) => {
    const { h, dlPath } = await setup(makeDownloadAdapter);

    const { err, id } = await download(h, "always");

    expect(err).toBeNull();
    expect(id).toBe("new-0");
    const localPath = h.getState().persistent.downloads.files["new-0"].localPath;
    expect(localPath).not.toBe("file.bin");
    await expect(readFile(path.join(dlPath, localPath ?? ""), "utf8")).resolves.toBe("fresh");
    await expect(readFile(path.join(dlPath, "file.bin"), "utf8")).resolves.toBe("original");
  });
});
