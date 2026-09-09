import * as path from "node:path";

import type { PluginCleaningData } from "loot";
import { describe, expect, vi } from "vitest";

import { startActivity } from "../../actions/session";
import {
  makeLootPluginInterface,
  makePlugin,
  makePluginLoot,
  makePluginMetadata,
} from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import { setPluginList } from "./actions/plugins";
import LootInterface from "./autosort";
import { downloadMasterlistMock, downloadPreludeMock } from "./lootMocks";

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

describe("LootInterface plugin-details", () => {
  test("emits loot-info-updated before answering", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    const order: string[] = [];
    harness.api.events.on("trigger-test-run", (id: string) => order.push(`trigger:${id}`));

    await new Promise<void>((resolve) => {
      harness.emit("plugin-details", "skyrimse", [], () => {
        order.push("callback");
        resolve();
      });
    });

    expect(order).toEqual(["trigger:loot-info-updated", "callback"]);
  });

  test("answers with no details while a dependency install is running", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(startActivity("installing_dependencies", "collection-1"));

    const result = await harness.requestDetails(["one.esp"]);

    expect(result).toEqual({});
    expect(harness.loot.clearConditionCacheAsync).not.toHaveBeenCalled();
  });

  test("answers with no details when loot is closed", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.isClosed.mockReturnValue(true);

    const result = await harness.requestDetails(["one.esp"]);

    expect(result).toEqual({});
  });

  test("answers with no details when loot failed to initialize", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface, { initError: new Error("no loot binding") });

    const result = await harness.requestDetails(["one.esp"]);

    expect(result).toEqual({});
  });

  test("loads only deployed non-invalid plugins and reports the skipped ones once", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface, { invalidPlugins: ["three.esp"] });
    harness.api.store.dispatch(
      setPluginList({
        "one.esp": makePlugin(),
        "two.esp": makePlugin({ deployed: false }),
        "three.esp": makePlugin(),
      }),
    );

    const result = await harness.requestDetails(["one.esp", "two.esp", "three.esp"]);

    expect(harness.loot.loadPluginsAsync).toHaveBeenCalledWith(["one.esp"], false);
    expect(
      harness.notifications.filter(
        (notification) => notification.id === "loot-skipped-invalid-plugins",
      ),
    ).toHaveLength(1);
    // every requested plugin still gets a details entry
    expect(Object.keys(result).sort()).toEqual(["one.esp", "three.esp", "two.esp"]);
  });

  test("maps loot metadata and plugin info into the plugin details", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin() }));
    const cleaning: PluginCleaningData = {
      CRC: 1,
      itmCount: 2,
      deletedReferenceCount: 0,
      deletedNavmeshCount: 0,
      cleaningUtility: "xEdit",
      info: [],
    };
    const meta = makePluginMetadata({
      messages: [{ type: 1, content: "watch out", condition: "" }],
      tags: [{ isAddition: true, name: "Delev", condition: "" }],
      cleanInfo: [cleaning],
      dirtyInfo: [cleaning],
      group: "late loaders",
      requirements: [{ name: "Req.esp", displayName: "Req" }],
    });
    const info = makeLootPluginInterface({
      bashTags: [{ isAddition: false, name: "C.Water", condition: "" }],
      isValidAsLightPlugin: true,
      loadsArchive: true,
      version: "1.2.0",
    });
    harness.loot.getPluginMetadataAsync.mockResolvedValue(meta);
    harness.loot.getPluginAsync.mockResolvedValue(info);

    const result = await harness.requestDetails(["one.esp"]);

    expect(result["one.esp"]).toEqual(
      makePluginLoot({
        messages: meta.messages,
        currentTags: info.bashTags,
        suggestedTags: meta.tags,
        cleanliness: meta.cleanInfo,
        dirtyness: meta.dirtyInfo,
        group: "late loaders",
        requirements: [{ name: "Req.esp", display: "Req" }],
        isValidAsLightPlugin: true,
        loadsArchive: true,
        version: "1.2.0",
      }),
    );
  });

  test("flags plugins without loot metadata for manual grouping", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin() }));

    const result = await harness.requestDetails(["one.esp"]);

    const messages = result["one.esp"].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe(-1);
    expect(messages[0].condition).toBe("always");
    expect(messages[0].content).toContain("No LOOT metadata could be found");
  });

  test("answers empty details per plugin and aggregates one error when metadata lookups fail", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.getPluginMetadataAsync.mockRejectedValue(new Error("metadata query failed"));

    const result = await harness.requestDetails(["one.esp", "two.esp"]);

    expect(result["one.esp"]).toEqual(makePluginLoot());
    expect(result["two.esp"]).toEqual(makePluginLoot());
    expect(
      harness.errorNotifications.filter(
        (entry) => entry.title === "There were errors getting plugin information from LOOT",
      ),
    ).toHaveLength(1);
  });

  test("suppresses the error report when loot closed mid-iteration", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    harness.loot.getPluginMetadataAsync.mockImplementation((pluginName) =>
      Promise.reject(
        new Error(pluginName === "one.esp" ? "already closed" : "metadata query failed"),
      ),
    );

    const result = await harness.requestDetails(["one.esp", "two.esp"]);

    expect(result["two.esp"]).toEqual(makePluginLoot());
    expect(harness.errorNotifications).toEqual([]);
  });

  test("downloads the base game's masterlist for VR variants and reports the update", async ({
    makeLoot,
  }) => {
    const harness = await makeLoot(LootInterface);
    const events: string[] = [];
    harness.api.events.on("did-update-masterlist", () => events.push("did-update-masterlist"));

    await harness.lootInterface.downloadMasterlist("skyrimvr");

    expect(downloadPreludeMock).toHaveBeenCalled();
    // the repo id maps to the base game while the local path keeps the VR game's own folder
    expect(downloadMasterlistMock).toHaveBeenCalledWith(
      "skyrimse",
      expect.stringContaining(path.join("skyrimvr", "masterlist")),
    );
    expect(events).toEqual(["did-update-masterlist"]);
  });

  test("reports a failed masterlist download without offering a report", async ({ makeLoot }) => {
    const harness = await makeLoot(LootInterface);
    downloadMasterlistMock.mockRejectedValueOnce(new Error("network down"));

    await harness.lootInterface.downloadMasterlist("skyrimse");

    expect(harness.errorNotifications).toContainEqual(
      expect.objectContaining({ title: "Failed to update masterlist", allowReport: false }),
    );
  });
});
