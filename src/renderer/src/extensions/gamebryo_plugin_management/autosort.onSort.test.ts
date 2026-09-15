import * as path from "node:path";

import { describe, expect, vi } from "vitest";

import { startActivity, stopActivity } from "../../actions/session";
import { flushAsync } from "../../test-utils/async";
import { makeProfile } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import { setPluginOrder } from "./actions/loadOrder";
import { setAutoSortEnabled } from "./actions/settings";
import LootInterface from "./autosort";

// the five seams the autosort suites share; each factory delegates to lootMocks so the
// replacement behavior is arranged per test through makeLoot
// TODO LAZ-1037: these module paths follow the decomposition as the mocked modules move
vi.mock(
  "../../util/webpack-hacks",
  async () => (await import("./lootMocks.js")).webpackHacksModule,
);
vi.mock(
  "../../util/getVortexPath",
  async () => (await import("./lootMocks.js")).getVortexPathModule,
);
vi.mock("./util/gameSupport", async () => (await import("./lootMocks.js")).gameSupportModule);
vi.mock("./util/masterlist", async () => (await import("./lootMocks.js")).masterlistModule);
vi.mock(
  "./util/findInvalidPlugins",
  async () => (await import("./lootMocks.js")).invalidPluginsModule,
);

describe("LootInterface autosort-plugins", () => {
  test("defers sorting while a dependency install is running", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(startActivity("installing_dependencies", "collection-1"));

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
    expect(harness.notifications).toEqual([]);
  });

  // deployment relinks plugin files, so a sort started mid-deployment sees transient missing plugins
  test("defers sorting while a mod deployment is running and sorts once it ends", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.api.store.dispatch(startActivity("mods", "deployment"));

    await harness.sort(false);
    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();

    harness.api.store.dispatch(stopActivity("mods", "deployment"));
    await vi.waitFor(() => expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["A.esp"]));
  });

  test("runs a manual sort deferred behind a deployment even with auto-sort disabled", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.api.store.dispatch(setAutoSortEnabled(false));
    harness.api.store.dispatch(startActivity("mods", "deployment"));

    await harness.sort(true);
    harness.api.store.dispatch(stopActivity("mods", "deployment"));

    await vi.waitFor(() => expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(1));
  });

  test("skips sorting when not manual and autoSort is disabled", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setAutoSortEnabled(false));

    await harness.sort(false);

    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
  });

  test("does not claim a successful sort when the autoSort gate skipped sorting", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setAutoSortEnabled(false));

    await harness.sort(false);

    expect(harness.notifications).not.toContainEqual(
      expect.objectContaining({ id: "loot-sorted" }),
    );
  });

  test("answers the callback when the active game changed since initialization", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.setState((draft) => {
      draft.persistent.profiles["profile-2"] = makeProfile({ id: "profile-2", gameId: "oblivion" });
      draft.settings.profiles.activeProfileId = "profile-2";
    });

    const callback = vi.fn<(err: Error | null) => void>();
    harness.emit("autosort-plugins", true, callback);
    await harness.lootInterface.wait();
    await flushAsync();

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  test("reports an error to the callback when loot failed to initialize", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface, { initError: new Error("no loot binding") });

    const err = await harness.sort(true);

    expect(err?.message).toBe("LOOT is uninitialized/closed");
    expect(harness.errorNotifications).toContainEqual(
      expect.objectContaining({ title: "Failed to initialize LOOT", allowReport: false }),
    );
  });

  test("reports an error to the callback when loot is closed", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.isClosed.mockReturnValue(true);

    const err = await harness.sort(true);

    expect(err?.message).toBe("LOOT is uninitialized/closed");
    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
  });

  test("sorts only deployed non-ghost plugins plus natives", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins([
      "One.esp",
      { name: "Two.esp", deployed: false },
      "Three.esp.ghost",
      { name: "Four.esp", deployed: false, isNative: true },
    ]);

    const err = await harness.sort(true);

    expect(err).toBeNull();
    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["One.esp", "Four.esp"]);
  });

  test("hands plugins to loot in current load order, unknown plugins last", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["C.esp", "A.esp", "B.esp"]);
    // A and B have load order 0 and 1; C is not in the hive yet
    harness.api.store.dispatch(setPluginOrder(["A.esp", "B.esp"], true));

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["A.esp", "B.esp", "C.esp"]);
  });

  test("drops plugins whose file is missing and passes file basenames", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins([
      "Real.esp",
      // state claims the plugin but no file backs it
      { name: "Gone.esp", filePath: path.join(harness.dataDir, "Gone.esp") },
    ]);

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["Real.esp"]);
  });

  test("sorts exactly the given files in their current order and answers libloot's order", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp", "B.esp", "C.esp"]);
    harness.api.store.dispatch(setPluginOrder(["C.esp", "B.esp", "A.esp"], true));
    harness.loot.sortPluginsAsync.mockResolvedValueOnce(["A.esp", "B.esp"]);

    const sorted = await harness.lootInterface.sortFiles([
      path.join(harness.dataDir, "A.esp"),
      path.join(harness.dataDir, "Gone.esp"),
      path.join(harness.dataDir, "B.esp"),
    ]);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["B.esp", "A.esp"]);
    expect(sorted).toEqual(["A.esp", "B.esp"]);
  });

  test("answers an empty list when none of the given files exist", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);

    await expect(
      harness.lootInterface.sortFiles([path.join(harness.dataDir, "Gone.esp")]),
    ).resolves.toEqual([]);
  });

  test("rejects a file sort requested during a deployment instead of answering unsorted", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.api.store.dispatch(startActivity("mods", "deployment"));

    await expect(
      harness.lootInterface.sortFiles([path.join(harness.dataDir, "A.esp")]),
    ).rejects.toMatchObject({ data: { kind: "process-canceled" } });
    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
  });

  test("queues a second sort behind the pending one", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    let release: (sorted: string[]) => void;
    harness.loot.sortPluginsAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const first = harness.sort(true);
    await vi.waitFor(() => expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(1));
    const second = harness.sort(true);
    await flushAsync();

    // the second sort waits on the pending sort promise instead of interleaving
    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(1);

    release([]);
    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(2);
  });
});
