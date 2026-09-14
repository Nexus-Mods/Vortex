/**
 * Pins the libloot call lifecycle against the documented 0.29.3 contract (the vendored
 * game_interface.h/database_interface.h docblocks) and the sequences the official LOOT
 * application runs: SortPlugins only sorts plugins already loaded via LoadPlugins, and
 * LoadCurrentLoadOrderState is the caller's job whenever on-disk state changes (both loads also
 * clear the condition cache). node-loot passes every call straight through, so the lifecycle is
 * autosort's responsibility.
 */
import { writeFile } from "node:fs/promises";

import { describe, expect, onTestFinished, vi } from "vitest";

import { flushAsync } from "../../test-utils/async";
import { makePlugin } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import { setPluginList } from "./actions/plugins";
import LootInterface from "./autosort";
import { createLootMock, downloadMasterlistMock } from "./lootMocks";

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

describe("LootInterface libloot lifecycle", () => {
  test("recreates the loot instance and reloads its state when helpers restart", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);

    harness.restartHelpers();
    await vi.waitFor(() => {
      expect(harness.loot.loadCurrentLoadOrderStateAsync).toHaveBeenCalled();
    });

    // the documented init order: fresh handle, fresh lists, then the load-order state
    expect(createLootMock).toHaveBeenCalledTimes(1);
    expect(createLootMock).toHaveBeenCalledBefore(downloadMasterlistMock);
    expect(downloadMasterlistMock).toHaveBeenCalledBefore(harness.loot.loadListsAsync);
    expect(harness.loot.loadListsAsync).toHaveBeenCalledBefore(
      harness.loot.loadCurrentLoadOrderStateAsync,
    );
  });

  test("closes the replaced loot instance after its grace period", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    // only setTimeout is faked: Bluebird schedules on setImmediate, which flushAsync drains
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    harness.restartHelpers();
    // the close timer is scheduled as soon as the restart handler resumes
    await flushAsync();

    expect(harness.loot.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(harness.loot.close).toHaveBeenCalledTimes(1);
  });

  test("prepares the libloot state before reading plugin data", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin() }));

    await harness.requestDetails(["one.esp"]);

    // metadata conditions (active(), version()...) evaluate against the cached load-order state,
    // and the state refresh also invalidates the condition cache
    expect(harness.loot.loadCurrentLoadOrderStateAsync).toHaveBeenCalledBefore(
      harness.loot.getPluginMetadataAsync,
    );
    // GetPlugin only answers for loaded plugins, and the record-level fields
    // (isValidAsLightPlugin, loadsArchive, isEmpty) need a full parse, not headers
    expect(harness.loot.loadPluginsAsync).toHaveBeenCalledBefore(harness.loot.getPluginAsync);
  });

  // LoadCurrentLoadOrderState "should be called whenever the load order or active state of
  // plugins 'on disk' changes"; with stale state, sort tie-breaking degrades to filename order.
  // Only init and plugin-details load it.
  test.fails("loads the current load-order state before sorting", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);

    await harness.sort(true);

    expect(harness.loot.loadCurrentLoadOrderStateAsync).toHaveBeenCalledBefore(
      harness.loot.sortPluginsAsync,
    );
  });

  // "All given plugins must have been loaded using LoadPlugins()" - a sort only succeeds when
  // plugin-details loaded the plugins earlier (the LAZ-1092/LAZ-1036 PluginNotLoaded failures)
  test.fails("loads the plugins being sorted before sorting them", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);

    await harness.sort(true);

    expect(harness.loot.loadPluginsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("A.esp")]),
      false,
    );
    expect(harness.loot.loadPluginsAsync).toHaveBeenCalledBefore(harness.loot.sortPluginsAsync);
  });

  // lists are held in memory and nothing watches the files, so a downloaded masterlist has to be
  // re-loaded to take effect; the implementation downloads without reloading, and readLists only
  // reloads when the userlist mtime changed. Expected-fail until the fix lands, which flips this
  // to a plain test.
  test.fails("reloads the metadata lists after downloading a fresh masterlist", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);

    await harness.lootInterface.downloadMasterlist("skyrimse");

    expect(harness.loot.loadListsAsync).toHaveBeenCalled();
  });

  // a rule change reaches libloot by re-loading the rewritten userlist; only the sort path
  // reloads, so plugin details answer from the stale lists
  test.fails("answers plugin details from a reloaded userlist after a rule change", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin() }));
    await writeFile(harness.userlistPath, "plugins:\n  - name: One.esp\n    group: early\n");

    await harness.requestDetails(["one.esp"]);

    expect(harness.loot.loadListsAsync).toHaveBeenCalledBefore(harness.loot.getPluginMetadataAsync);
  });
});
