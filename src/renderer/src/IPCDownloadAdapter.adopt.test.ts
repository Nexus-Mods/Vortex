import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, vi } from "vitest";

// getVortexPath reads electron's userData/temp dirs, which aren't wired up in tests, so (like
// migrate.test.ts and the main adapter suite) it's mocked. It points at a real temp dir here so
// adoption's file copy/hash/cleanup run against a real filesystem rather than mocks.
const paths = vi.hoisted(() => ({ root: "" }));
vi.mock("./util/getVortexPath", () => ({ default: () => paths.root }));

import { finishDownload } from "./extensions/download_management/actions/state";
import { downloadPathForGame } from "./extensions/download_management/selectors";
import { test } from "./test-utils/downloadAdapterTest";

// browse-for-download encodes a completed blob as "<url>|<fileName><<referer>".
const BLOB = "blob:https://mega.nz/uuid|Cool Mod.7z<https://mega.nz/file/uuid";

describe("blob adoption", () => {
  beforeEach(async () => {
    paths.root = await mkdtemp(path.join(tmpdir(), "vortex-adopt-"));
  });

  afterEach(async () => {
    await rm(paths.root, { recursive: true, force: true });
  });

  test("adopts a browser blob (already saved to temp) as a finished download on disk", async ({
    makeDownloadAdapter,
  }) => {
    // the embedded browser saved the file to <temp>/<fileName>.tmp before handing back the blob url
    await writeFile(path.join(paths.root, "Cool Mod.7z.tmp"), "the mod bytes");

    const h = makeDownloadAdapter();
    const finished = vi.fn();
    h.events.on("did-finish-download", finished);

    const result = await new Promise<{ err: Error | null; id?: string }>((resolve) => {
      h.events.emit("start-download", [BLOB], { game: "skyrimse" }, undefined, (err, id) =>
        resolve({ err, id }),
      );
    });

    // adopted as a finished download; the blob was never handed to the network downloader
    expect(result.err).toBeNull();
    expect(result.id).toBeTruthy();
    expect(h.start).not.toHaveBeenCalled();
    expect(finished).toHaveBeenCalledWith(result.id, "finished");
    expect(h.dispatched).toContainEqual(finishDownload(result.id!, "finished", null));

    // the file really landed in the game's download folder under its parsed name, and the temp blob
    // was cleaned up
    const dlPath = downloadPathForGame(h.getState(), "skyrimse");
    await expect(access(path.join(dlPath, "Cool Mod.7z"))).resolves.toBeUndefined();
    await expect(access(path.join(paths.root, "Cool Mod.7z.tmp"))).rejects.toThrow();
  });

  test("reports an error for a blob with no file name and no hint", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter();

    const result = await new Promise<{ err: Error | null }>((resolve) => {
      h.events.emit(
        "start-download",
        ["blob:https://mega.nz/uuid<https://mega.nz/file/uuid"],
        { game: "skyrimse" },
        undefined,
        (err) => resolve({ err }),
      );
    });

    expect(result.err).toBeInstanceOf(Error);
    expect(h.start).not.toHaveBeenCalled();
  });
});
