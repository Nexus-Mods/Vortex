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
