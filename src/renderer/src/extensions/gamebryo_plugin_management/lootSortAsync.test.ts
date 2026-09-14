import { describe, expect, vi } from "vitest";

import { makePlugin } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../test-utils/harnessTypes";
import { setPluginOrder } from "./actions/loadOrder";
import { setPluginList } from "./actions/plugins";
import { makeLootSortAsync } from "./lootSortAsync";
import type { ILOOTSortApiCall } from "./types/ILOOTList";

function setup(harness: IGamebryoHarness, sortError: Error | null = null) {
  const masterlistExists = vi.fn<(gameId: string) => Promise<boolean>>(() => Promise.resolve(true));
  const downloadMasterlist = vi.fn<(gameMode: string) => Promise<void>>(() => Promise.resolve());
  const updatePluginList = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const detailsListener = vi.fn(
    (_gameId: string, _plugins: string[], cb: (result: object) => void) => {
      cb({});
    },
  );
  harness.api.events.on("plugin-details", detailsListener);
  const sortListener = vi.fn((_manual: boolean, cb?: (err: Error | null) => void) => {
    cb?.(sortError);
  });
  harness.api.events.on("autosort-plugins", sortListener);
  const handler = makeLootSortAsync(harness.api, {
    masterlistExists,
    downloadMasterlist,
    updatePluginList,
  });
  const callback = vi.fn<(err: Error | null, result: string[]) => void>();
  const sort = (pluginFilePaths: string[] = []) =>
    handler({ pluginFilePaths, onSortCallback: callback });
  return {
    masterlistExists,
    downloadMasterlist,
    updatePluginList,
    detailsListener,
    sortListener,
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
    const { downloadMasterlist, sortListener, sort } = setup(makeGamebryo());

    await sort();

    expect(downloadMasterlist).not.toHaveBeenCalled();
    expect(sortListener).toHaveBeenCalled();
  });

  test("requests plugin details for every known plugin before sorting", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { updatePluginList, detailsListener, sortListener, sort } = setup(harness);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin(), "two.esp": makePlugin() }));

    await sort();

    expect(detailsListener).toHaveBeenCalledWith(
      "skyrimse",
      ["one.esp", "two.esp"],
      expect.any(Function),
    );
    expect(updatePluginList).toHaveBeenCalledBefore(detailsListener);
    expect(detailsListener).toHaveBeenCalledBefore(sortListener);
  });

  // the answer is always rebuilt from the whole loadOrder hive, lowercased; the paths argument
  // does not narrow it (LAZ-1048 decides the final contract for that parameter)
  test("answers the callback with the load order sorted and lowercased", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { callback, sort } = setup(harness);
    harness.api.store.dispatch(setPluginOrder(["B.esp", "A.esp"], true));

    await sort();
    await sort(["Unrelated.esp"]);

    expect(callback.mock.calls).toEqual([
      [null, ["b.esp", "a.esp"]],
      [null, ["b.esp", "a.esp"]],
    ]);
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

  // the desired contract from LAZ-1048: a malformed call must not blow up the caller; the
  // implementation's guard invokes the very callback it just found missing
  test.fails("survives a call that carries no callback", async ({ makeGamebryo }) => {
    const { handler } = setup(makeGamebryo());

    await expect(handler({ pluginFilePaths: [] } as ILOOTSortApiCall)).resolves.toBeUndefined();
  });

  // the desired contract from LAZ-1048: one answer per call; the implementation reports the sort
  // error and then falls through to also report a success with the unsorted list
  test.fails("answers the callback exactly once when the sort fails", async ({ makeGamebryo }) => {
    const { callback, sort } = setup(makeGamebryo(), new Error("Cyclic interaction"));

    await sort();

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
