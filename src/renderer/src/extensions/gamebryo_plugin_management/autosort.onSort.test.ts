import * as path from "node:path";

import { describe, expect, vi } from "vitest";

import { startActivity } from "../../actions/session";
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

// drain the queued Bluebird continuations (setImmediate-scheduled) and microtasks so an emitted
// sort settles before a negative assertion, without betting on a wall-clock delay
async function flushAsync(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("LootInterface autosort-plugins", () => {
  test("defers sorting while a dependency install is running", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(startActivity("installing_dependencies", "collection-1"));

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
    expect(harness.notifications).toEqual([]);
  });

  // the desired contract from LAZ-1092: deployment relinks plugin files, so a sort started
  // mid-deployment sees transient missing plugins; the implementation only defers on
  // installing_dependencies. Expected-fail until the fix lands, which flips this to a plain test.
  test.fails("defers sorting while a mod deployment is running", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(startActivity("mods", "deployment"));

    await harness.sort(false);

    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
  });

  test("skips sorting when not manual and autoSort is disabled", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setAutoSortEnabled(false));

    await harness.sort(false);

    expect(harness.loot.sortPluginsAsync).not.toHaveBeenCalled();
  });

  // the desired contract from LAZ-1049: the implementation still toasts success on this skip
  // path. Expected-fail until the fix lands, which flips this to a plain test.
  test.fails("does not claim a successful sort when the autoSort gate skipped sorting", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setAutoSortEnabled(false));

    await harness.sort(false);

    expect(harness.notifications).not.toContainEqual(
      expect.objectContaining({ id: "loot-sorted" }),
    );
  });

  // the desired contract from LAZ-1048: the implementation still returns without answering,
  // which is the silent hang lootSortAsync's stuck spinner is built on. Expected-fail until the
  // fix lands, which flips this to a plain test.
  test.fails("answers the callback when the active game changed since initialization", async ({
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

  test("hands plugins to loot in current load order, unknown plugins first", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    await harness.seedPlugins(["A.esp", "B.esp", "C.esp"]);
    // A and B have load order 0 and 1; C is unknown to the hive and defaults to -1
    harness.api.store.dispatch(setPluginOrder(["A.esp", "B.esp"], true));

    await harness.sort(true);

    expect(harness.loot.sortPluginsAsync).toHaveBeenCalledWith(["C.esp", "A.esp", "B.esp"]);
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
