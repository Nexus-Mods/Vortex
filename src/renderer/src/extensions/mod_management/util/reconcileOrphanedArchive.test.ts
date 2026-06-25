import { expect, vi } from "vitest";

import { makeDownload } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { reconcileOrphanedArchive } from "./reconcileOrphanedArchive";

const { statMock } = vi.hoisted(() => ({ statMock: vi.fn() }));
vi.mock("node:fs/promises", () => ({ default: { stat: statMock }, stat: statMock }));

// record each refresh-downloads emission (by gameId) and answer its callback so the helper resolves
function trackRefresh(api: IExtensionApi): string[] {
  const calls: string[] = [];
  api.events.on("refresh-downloads", (gameId: string, done: () => void) => {
    calls.push(gameId);
    done();
  });
  return calls;
}

test("reconcileOrphanedArchive is a no-op when no file name is given", async ({ makeApi }) => {
  const { api } = makeApi();
  const refreshed = trackRefresh(api);
  await reconcileOrphanedArchive(api, "skyrimse", undefined);
  await reconcileOrphanedArchive(api, "skyrimse", "");
  expect(statMock).not.toHaveBeenCalled();
  expect(refreshed).toHaveLength(0);
});

test("reconcileOrphanedArchive leaves the disk alone when a record already tracks the file", async ({
  makeApi,
}) => {
  const { api } = makeApi({ downloads: { "dl-1": makeDownload({ localPath: "mod.zip" }) } });
  const refreshed = trackRefresh(api);
  await reconcileOrphanedArchive(api, "skyrimse", "mod.zip");
  expect(statMock).not.toHaveBeenCalled();
  expect(refreshed).toHaveLength(0);
});

test("reconcileOrphanedArchive does not refresh when the untracked file is absent from disk", async ({
  makeApi,
}) => {
  statMock.mockRejectedValue(new Error("ENOENT"));
  const { api } = makeApi();
  const refreshed = trackRefresh(api);
  await reconcileOrphanedArchive(api, "skyrimse", "mod.zip");
  expect(statMock).toHaveBeenCalledOnce();
  expect(refreshed).toHaveLength(0);
});

test("reconcileOrphanedArchive refreshes downloads for an untracked file present on disk", async ({
  makeApi,
}) => {
  statMock.mockResolvedValue({} as never);
  const { api } = makeApi({ downloads: { "dl-1": makeDownload({ localPath: "other.zip" }) } });
  const refreshed = trackRefresh(api);
  await reconcileOrphanedArchive(api, "skyrimse", "mod.zip");
  expect(refreshed).toEqual(["skyrimse"]);
});
