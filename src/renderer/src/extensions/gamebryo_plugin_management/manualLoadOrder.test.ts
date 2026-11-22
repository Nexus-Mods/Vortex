import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import { VortexGameId } from "@vortex/shared";
import { describe, expect, vi } from "vitest";

import { makePlugin } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import { makeTempDir } from "../../test-utils/tempDir";
import { setPluginOrder } from "./actions/loadOrder";
import { setPluginList } from "./actions/plugins";
import { setBetaLoadOrder } from "./actions/settings";
import {
  makeManualLoadOrder,
  registerManualLoadOrders,
  validateManualLoadOrder,
} from "./manualLoadOrder";
import { initGameSupport } from "./util/gameSupport";

const baseGamePlugins = {
  enderal: "Skyrim.esm",
  enderalspecialedition: "Skyrim.esm",
  fallout3: "Fallout3.esm",
  fallout4: "Fallout4.esm",
  fallout4vr: "Fallout4.esm",
  falloutnv: "FalloutNV.esm",
  oblivion: "Oblivion.esm",
  skyrim: "Skyrim.esm",
  skyrimse: "Skyrim.esm",
  skyrimvr: "Skyrim.esm",
};
const entry = (id: string, overrides = {}) => ({
  id,
  name: id,
  enabled: true,
  data: { native: false, isMaster: false, masters: [] as string[] },
  ...overrides,
});
const native = entry("fallout4.esm", { data: { native: true, isMaster: true, masters: [] } });
const master = entry("master.esm", {
  data: { native: false, isMaster: true, masters: ["Fallout4.esm"] },
});
const dependent = entry("dependent.esp", {
  data: { native: false, isMaster: false, masters: ["Master.esm"] },
});

describe("Bethesda drag-and-drop load order adapter", () => {
  test("accepts a reordered list of independent plugins without enabling disabled entries", () => {
    const baseline = [native, entry("a.esp"), entry("b.esp", { enabled: false })];
    expect(
      validateManualLoadOrder(baseline, [baseline[0], baseline[2], baseline[1]]),
    ).toBeUndefined();
  });
  test.each([
    [dependent, native, master],
    [native, dependent, master],
    [native, { ...master, enabled: false }, dependent],
    [{ ...native, enabled: false }, master, dependent],
  ])("rejects native, master-order or enabled-master violations", (...current) => {
    expect(
      validateManualLoadOrder([native, master, dependent], current)?.invalid.length,
    ).toBeGreaterThan(0);
  });
  test("refuses omitted, duplicate and unknown plugin identities", () => {
    for (const current of [[native], [native, native], [native, entry("unknown.esp")]]) {
      expect(validateManualLoadOrder([native, master], current)?.invalid.length).toBeGreaterThan(0);
    }
  });
  test("registers shared Bethesda games without replacing existing Starfield and Remastered pages", ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const add = vi.fn();
    harness.api.ext.addLoadOrderPage = add;
    registerManualLoadOrders(harness.api);
    const ids = add.mock.calls.map(([registration]) => registration.gameId);
    expect(ids.toSorted()).toEqual(Object.keys(baseGamePlugins).toSorted());
    expect(ids).not.toContain("starfield");
    expect(ids).not.toContain("oblivionremastered");
  });
  test.for(Object.entries(baseGamePlugins))(
    "round-trips the shared adapter for %s",
    async ([gameId, basePlugin], { makeGamebryo }) => {
      const harness = makeGamebryo({ gameId });
      await initGameSupport(harness.api);
      const root = await makeTempDir("vortex-manual-order-");
      const names = [basePlugin, "Alpha.esp", "Beta.esp"];
      for (const name of names) {
        const headerSize = gameId === "oblivion" ? 20 : 24;
        const headerDataSize = 12;
        const recordSize = 6 + headerDataSize;
        const bytes = Buffer.alloc(headerSize + recordSize);
        bytes.writeUInt32LE(recordSize, 4);
        bytes.write("HEDR", headerSize);
        bytes.writeUInt16LE(headerDataSize, headerSize + 4);
        bytes.write("TES4");
        if (name.endsWith(".esm")) bytes.writeUInt32LE(1, 8);
        await writeFile(path.join(root, name), bytes);
      }
      harness.api.store.dispatch(
        setPluginList(
          Object.fromEntries(
            names.map((name) => [
              name.toLowerCase(),
              makePlugin({
                filePath: path.join(root, name),
                deployed: true,
                isNative: false,
              }),
            ]),
          ),
        ),
      );
      harness.api.store.dispatch(setPluginOrder(names, true));
      const adapter = makeManualLoadOrder(harness.api, VortexGameId(gameId));
      expect(adapter.condition()).toBe(false);
      expect(await adapter.deserializeLoadOrder()).toEqual([]);
      harness.api.store.dispatch(setBetaLoadOrder(harness.profileId, true));
      const baseline = await adapter.deserializeLoadOrder();
      const reordered = [baseline[0], { ...baseline[2], enabled: false }, baseline[1]];
      await adapter.serializeLoadOrder(reordered, baseline);
      expect(harness.getState().loadOrder["beta.esp"]).toMatchObject({
        loadOrder: 1,
        enabled: false,
      });
      expect(harness.getState().loadOrder["alpha.esp"]).toMatchObject({
        loadOrder: 2,
        enabled: true,
      });
      expect((await adapter.deserializeLoadOrder())[0]).toMatchObject({
        locked: true,
        enabled: true,
      });
      const before = harness.getState().loadOrder;
      await expect(adapter.serializeLoadOrder(baseline, baseline)).rejects.toThrow(
        "The plugin order changed",
      );
      expect(harness.getState().loadOrder).toBe(before);
      await expect(
        adapter.serializeLoadOrder([reordered[1], reordered[0], reordered[2]], reordered),
      ).rejects.toMatchObject({
        validationResult: {
          invalid: expect.arrayContaining([
            expect.objectContaining({ reason: expect.stringContaining("Base game plugins") }),
          ]),
        },
      });
      expect(harness.getState().loadOrder).toBe(before);
      harness.api.store.dispatch(setBetaLoadOrder(harness.profileId, false));
      expect(adapter.condition()).toBe(false);
      await expect(adapter.serializeLoadOrder(reordered, baseline)).rejects.toThrow();
      expect(harness.getState().loadOrder).toBe(before);
    },
  );
  test("orders unflagged masters first and shows unreadable plugins without writing", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo({ gameId: "fallout4" });
    await initGameSupport(harness.api);
    const root = await makeTempDir("vortex-manual-order-headers-");
    const names = ["Ordinary.esp", "Light.esl", "Master.esm", "Damaged.esp"];
    const bytes = Buffer.alloc(24);
    bytes.write("TES4");
    for (const name of names) {
      await writeFile(path.join(root, name), name === "Damaged.esp" ? "corrupt" : bytes);
    }
    harness.api.store.dispatch(
      setPluginList(
        Object.fromEntries(
          names.map((name) => [
            name.toLowerCase(),
            makePlugin({ filePath: path.join(root, name), deployed: true }),
          ]),
        ),
      ),
    );
    harness.api.store.dispatch(setPluginOrder(names, true));
    harness.api.store.dispatch(setBetaLoadOrder(harness.profileId, true));
    const adapter = makeManualLoadOrder(harness.api, VortexGameId("fallout4"));
    const before = harness.getState().loadOrder;
    const order = await adapter.deserializeLoadOrder();
    expect(order.map((item) => item.name)).toEqual([
      "Light.esl",
      "Master.esm",
      "Ordinary.esp",
      "Damaged.esp",
    ]);
    await expect(adapter.serializeLoadOrder(order, order)).rejects.toMatchObject({
      validationResult: {
        invalid: [
          { id: "damaged.esp", reason: expect.stringContaining("Could not read Damaged.esp") },
        ],
      },
    });
    expect(harness.getState().loadOrder).toBe(before);
  });
  test("an empty deployed scan leaves existing plugin positions untouched", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo({ gameId: "fallout4" });
    await initGameSupport(harness.api);
    harness.api.store.dispatch(setBetaLoadOrder(harness.profileId, true));
    harness.api.store.dispatch(setPluginOrder(["Beta.esp", "Alpha.esp"], true));
    const before = harness.getState().loadOrder;
    await makeManualLoadOrder(harness.api, VortexGameId("fallout4")).serializeLoadOrder([], []);
    expect(harness.getState().loadOrder).toBe(before);
  });
});
