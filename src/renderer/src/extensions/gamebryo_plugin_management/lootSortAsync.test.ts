import * as path from "node:path";

import { describe, expect, onTestFinished, vi } from "vitest";

import { test } from "../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../test-utils/harnessTypes";
import { LOOT_SORT_API_DEADLINE_MS, makeLootSortAsync } from "./lootSortAsync";
import type { ILOOTSortApiCall } from "./types/ILOOTList";

function setup(harness: IGamebryoHarness) {
  const masterlistExists = vi.fn<(gameId: string) => Promise<boolean>>(() => Promise.resolve(true));
  const downloadMasterlist = vi.fn<(gameMode: string) => Promise<void>>(() => Promise.resolve());
  const updatePluginList = vi.fn<() => Promise<void>>(() => Promise.resolve());
  // stands in for libloot: answers the given files in the order given
  const sortFiles = vi.fn<(pluginFilePaths: string[]) => Promise<string[]>>((pluginFilePaths) =>
    Promise.resolve(pluginFilePaths.map((filePath) => path.basename(filePath))),
  );
  const handler = makeLootSortAsync(harness.api, {
    masterlistExists,
    downloadMasterlist,
    updatePluginList,
    sortFiles,
  });
  const callback = vi.fn<(err: Error | null, result: string[]) => void>();
  const sort = (pluginFilePaths: string[] = []) =>
    handler({ pluginFilePaths, onSortCallback: callback });
  return {
    masterlistExists,
    downloadMasterlist,
    updatePluginList,
    sortFiles,
    handler,
    callback,
    sort,
  };
}

describe("lootSortAsync", () => {
  test("downloads the masterlist before sorting when none exists", async ({ makeGamebryo }) => {
    const { masterlistExists, downloadMasterlist, updatePluginList, sort } = setup(makeGamebryo());
    masterlistExists.mockResolvedValueOnce(false);

    await sort();

    expect(downloadMasterlist).toHaveBeenCalledWith("skyrimse");
    expect(downloadMasterlist).toHaveBeenCalledBefore(updatePluginList);
  });

  test("sorts with the masterlist already on disk without re-downloading", async ({
    makeGamebryo,
  }) => {
    const { downloadMasterlist, sortFiles, sort } = setup(makeGamebryo());

    await sort();

    expect(downloadMasterlist).not.toHaveBeenCalled();
    expect(sortFiles).toHaveBeenCalled();
  });

  test("refreshes the plugin list before sorting", async ({ makeGamebryo }) => {
    const { updatePluginList, sortFiles, sort } = setup(makeGamebryo());

    await sort();

    expect(updatePluginList).toHaveBeenCalledBefore(sortFiles);
  });

  test("sorts exactly the given files and answers the order libloot chose", async ({
    makeGamebryo,
  }) => {
    const { callback, sortFiles, sort } = setup(makeGamebryo());
    const files = [path.join("D:", "Data", "B.esp"), path.join("D:", "Data", "A.esp")];
    sortFiles.mockResolvedValueOnce(["A.esp", "B.esp"]);

    await sort(files);

    expect(sortFiles).toHaveBeenCalledWith(files);
    expect(callback).toHaveBeenCalledWith(null, ["A.esp", "B.esp"]);
  });

  test("reports invalid call parameters to the callback", async ({ makeGamebryo }) => {
    const { handler, callback } = setup(makeGamebryo());

    await handler({
      pluginFilePaths: "not-an-array",
      onSortCallback: callback,
    } as unknown as ILOOTSortApiCall);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ message: "incorrect lootSortAsync call parameters" }),
      [],
    );
  });

  test("survives a call that carries no callback", async ({ makeGamebryo }) => {
    const { handler, sortFiles } = setup(makeGamebryo());

    await expect(handler({ pluginFilePaths: [] } as ILOOTSortApiCall)).resolves.toBeUndefined();

    expect(sortFiles).not.toHaveBeenCalled();
  });

  test("answers the callback exactly once when the sort fails", async ({ makeGamebryo }) => {
    const { callback, sortFiles, sort } = setup(makeGamebryo());
    sortFiles.mockRejectedValueOnce(new Error("Cyclic interaction"));

    await sort();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.any(Error), []);
  });

  test("answers with an error when the sort does not come back in time", async ({
    makeGamebryo,
  }) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { callback, sortFiles, sort } = setup(makeGamebryo());
    sortFiles.mockImplementation(() => new Promise(() => undefined));

    const call = sort();
    await vi.advanceTimersByTimeAsync(LOOT_SORT_API_DEADLINE_MS);
    await call;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.any(Error), []);
  });

  test("reports a plugin list update failure to the callback", async ({ makeGamebryo }) => {
    const { updatePluginList, callback, sort } = setup(makeGamebryo());
    updatePluginList.mockRejectedValue(new Error("scan failed"));

    await sort();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: "scan failed" }), []);
  });
});
