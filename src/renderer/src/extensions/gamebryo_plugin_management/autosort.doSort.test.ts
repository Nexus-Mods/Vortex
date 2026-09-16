import { rm, utimes, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, vi } from "vitest";

import { startActivity, stopActivity } from "../../actions/session";
import { test } from "../../test-utils/gamebryoTest";
import type { ILootHarness } from "../../test-utils/harnessTypes";
import {
  clearPendingPluginSort,
  setPendingPluginSort,
} from "../mod_management/actions/transactions";
import { updatePluginOrder } from "./actions/loadOrder";
import { setAutoEnable } from "./actions/settings";
import { setGroup } from "./actions/userlist";
import LootInterface from "./autosort";
import { EdgeType, type ICycleEdge } from "./types/ILoot";

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

function pendingSort(harness: ILootHarness): unknown {
  return harness.getState().persistent.transactions.pendingPluginSort[harness.profileId];
}

describe("LootInterface doSort", () => {
  test("dispatches the sorted order with the autoEnable setting", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp", "B.esp"]);
    harness.api.store.dispatch(setAutoEnable(true));
    harness.loot.sortPluginsAsync.mockResolvedValueOnce(["B.esp", "A.esp"]);

    const err = await harness.sort(true);

    expect(err).toBeNull();
    expect(harness.dispatched).toContainEqual(updatePluginOrder(["B.esp", "A.esp"], false, true));
    // the bound loadOrder reducer applied the write, so it reads back from the hive
    const loadOrder = harness.getGamebryoState().loadOrder;
    expect(loadOrder["b.esp"]).toEqual({ name: "B.esp", enabled: true, loadOrder: 0 });
    expect(loadOrder["a.esp"]).toEqual({ name: "A.esp", enabled: true, loadOrder: 1 });
  });

  test("clears the pending plugin-sort marker after a successful sort", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.api.store.dispatch(setPendingPluginSort(harness.profileId, "col-1", 1));

    await harness.sort(true);

    expect(harness.dispatched).toContainEqual(clearPendingPluginSort(harness.profileId));
    expect(pendingSort(harness)).toBeUndefined();
  });

  test("reports an empty-list sort as a distinct outcome instead of success", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setPendingPluginSort(harness.profileId, "col-1", 1));

    await harness.sort(true);

    expect(harness.notifications).not.toContainEqual(
      expect.objectContaining({ id: "loot-sorted" }),
    );
    expect(pendingSort(harness)).toEqual({ "col-1": 1 });
  });

  test("reports a failed sort to its caller instead of success", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(new Error("access violation"));

    const err = await harness.sort(true);

    expect(err).toBeInstanceOf(Error);
    expect(harness.notifications).not.toContainEqual(
      expect.objectContaining({ id: "loot-sorted" }),
    );
  });

  test("keeps the pending plugin-sort marker when loot closes mid-sort", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.api.store.dispatch(setPendingPluginSort(harness.profileId, "col-1", 1));
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(new Error("Already closed"));

    await harness.sort(true);

    // the interruption keeps the sort owed so the next profile activation retries it
    expect(pendingSort(harness)).toEqual({ "col-1": 1 });
  });

  test("excludes invalid plugins before sorting and reports them once sorted", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface, { invalidPlugins: ["Bad.esp"] });
    await harness.seedPlugins(["Good.esp", "Bad.esp"]);

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["Good.esp"]);
    expect(harness.notifications).toContainEqual(
      expect.objectContaining({ id: "loot-skipped-invalid-plugins", type: "warning" }),
    );
  });

  test("brackets the sort in a plugins/sorting activity, releasing it on failure", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(new Error("access violation"));

    await harness.sort(true);

    expect(harness.dispatched).toContainEqual(startActivity("plugins", "sorting"));
    expect(harness.dispatched).toContainEqual(stopActivity("plugins", "sorting"));
    expect(harness.getState().session.base.activity["plugins"] ?? []).toEqual([]);
    expect(harness.errorNotifications).toContainEqual(
      expect.objectContaining({ title: "LOOT operation failed", allowReport: false }),
    );
  });

  test("reports a cyclic-interaction error with the cycle dialog", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setGroup("A.esp", "early"));
    const cycle: ICycleEdge[] = [
      { name: "A.esp", typeOfEdgeToNextVertex: EdgeType.userGroup },
      { name: "B.esp", typeOfEdgeToNextVertex: EdgeType.userLoadAfter },
    ];
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(
      Object.assign(new Error('Cyclic interaction detected between "A.esp" and "B.esp"'), {
        cycle,
      }),
    );

    await harness.sort(true);

    await vi.waitFor(() => {
      expect(harness.notifications).toContainEqual(
        expect.objectContaining({ id: "loot-cycle-warning", type: "warning" }),
      );
    });
    // the group edge is explained through the groups path
    expect(harness.loot.getGroupsPathAsync).toHaveBeenCalled();

    const warning = harness.notifications.find(
      (notification) => notification.id === "loot-cycle-warning",
    );
    warning?.actions?.[0]?.action?.(() => undefined);
    await vi.waitFor(() => {
      expect(harness.dialogCalls).toContainEqual({ type: "info", title: "Cyclic interaction" });
    });
  });

  test("warns without re-sorting when loot rejects a plugin it could not load", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(
      Object.assign(new Error("plugin not loaded"), {
        name: "PluginNotLoaded",
        plugin: "A.esp",
      }),
    );

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(1);
    expect(harness.notifications).toContainEqual(
      expect.objectContaining({ id: "loot-failed", type: "warning" }),
    );
  });

  test("explains a sort that failed on a master the user has not installed", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    harness.loot.loadPluginsAsync.mockRejectedValueOnce(
      Object.assign(new Error('The plugin "M.esm" has not been loaded'), { func: "loadPlugins" }),
    );

    await harness.sort(true);

    const notSorted = harness.notifications.find(
      (notification) => notification.id === "loot-failed",
    );
    expect(notSorted?.type).toBe("warning");
    expect(notSorted?.message).toContain('"M.esm" to be installed, but it is missing');
  });

  // the plugin list says the master is deployed, the game folder has no such file
  test("reports a sort that failed on a master Vortex deployed as an error", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp", "M.esm"]);
    await rm(path.join(harness.dataDir, "M.esm"));
    harness.loot.loadPluginsAsync.mockRejectedValueOnce(
      Object.assign(new Error('The plugin "M.esm" has not been loaded'), { func: "loadPlugins" }),
    );

    await harness.sort(true);

    const notSorted = harness.notifications.find(
      (notification) => notification.id === "loot-failed",
    );
    expect(notSorted?.type).toBe("error");
    expect(notSorted?.message).toBe(
      'Plugins not sorted because: a plugin requires "M.esm", which was in the game folder when Vortex last scanned it but is gone',
    );
  });

  test("drops dangling group references and re-sorts once when a loot group is missing", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp"]);
    // a dangling reference to a group neither list knows
    harness.api.store.dispatch(setGroup("A.esp", "gone-group"));
    harness.loot.sortPluginsAsync
      .mockRejectedValueOnce(new Error('The group "gone-group" does not exist.'))
      .mockResolvedValueOnce(["A.esp"]);

    // the recovery path waits 500ms for the userlist persistor before re-sorting
    const err = await harness.sort(true);

    expect(err).toBeNull();
    expect(harness.dispatched).toContainEqual(setGroup("A.esp", undefined));
    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(2);
    expect(harness.dispatched).toContainEqual(updatePluginOrder(["A.esp"], false, false));
  });

  test("warns instead of re-sorting when a missing loot group has no recoverable references", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(
      new Error('The group "gone-group" does not exist.'),
    );

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledTimes(1);
    expect(harness.notifications).toContainEqual(
      expect.objectContaining({ id: "loot-failed", type: "warning" }),
    );
  });

  test("reports a version-condition failure as a non-reportable error with file details", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.setState((draft) => {
      draft.settings.gameMode.discovered["skyrimse"] = { path: harness.dataDir };
    });
    await writeFile(path.join(harness.dataDir, "SkyrimSE.exe"), "not a real executable");
    const sortError = new Error(
      'Failed to evaluate condition "version("SkyrimSE.exe", "1.5.97.0", >=)"',
    );
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(sortError);

    await harness.sort(true);

    // the report waits for the exe md5 probe, so it lands after the sort resolves
    await vi.waitFor(() => {
      expect(harness.errorNotifications).toContainEqual(
        expect.objectContaining({ title: "LOOT operation failed", allowReport: false }),
      );
    });
    const report = harness.errorNotifications.find(
      (notification) => notification.title === "LOOT operation failed",
    );
    const details = report?.message as { error: Error; File: string; Exists: boolean };
    expect(details.error.message).toContain("pirated copies of the game");
    expect(details.File).toBe(path.join(harness.dataDir, "SkyrimSE.exe"));
    expect(details.Exists).toBe(true);
  });

  test("reports a died loot process without offering a report", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.sortPluginsAsync.mockRejectedValueOnce(
      Object.assign(new Error("connection interrupted"), { name: "RemoteDied" }),
    );

    await harness.sort(true);

    expect(harness.errorNotifications).toContainEqual(
      expect.objectContaining({ title: "LOOT process died", allowReport: false }),
    );
  });

  test("re-loads the loot lists only when the userlist changed", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);

    await harness.sort(true);
    // no userlist on disk yet, so there is nothing to (re-)load
    expect(harness.loot.loadListsAsync).not.toHaveBeenCalled();

    await writeFile(harness.userlistPath, "plugins: []");
    await harness.sort(true);
    expect(harness.loot.loadListsAsync).toHaveBeenCalledTimes(1);

    // unchanged mtime hits the cache
    await harness.sort(true);
    expect(harness.loot.loadListsAsync).toHaveBeenCalledTimes(1);

    const later = new Date(Date.now() + 5000);
    await utimes(harness.userlistPath, later, later);
    await harness.sort(true);
    expect(harness.loot.loadListsAsync).toHaveBeenCalledTimes(2);
  });
});
