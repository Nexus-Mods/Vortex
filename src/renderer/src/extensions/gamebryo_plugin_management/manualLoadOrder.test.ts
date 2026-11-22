import { mkdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { VortexGameId } from "@vortex/shared";
import { describe, expect, onTestFinished, vi } from "vitest";

import { makePlugin } from "../../test-utils/builders";
import { installDiskFS } from "../../test-utils/fsApi";
import { test } from "../../test-utils/gamebryoTest";
import { makeTempDir } from "../../test-utils/tempDir";
import { setPluginOrder } from "./actions/loadOrder";
import { setPluginList } from "./actions/plugins";
import { setAutoSortEnabled, setBetaLoadOrder } from "./actions/settings";
import { controlsPluginOrder } from "./betaLoadOrder";
import {
  makeManualLoadOrder,
  registerManualLoadOrders,
  validateManualLoadOrder,
} from "./manualLoadOrder";
import { initGameSupport, pluginPath } from "./util/gameSupport";
import PluginPersistor from "./util/PluginPersistor";

const gameFixtures = {
  enderal: { master: "Skyrim.esm", folder: "Enderal", original: true },
  enderalspecialedition: {
    master: "Skyrim.esm",
    folder: "Enderal Special Edition",
    original: false,
  },
  fallout3: { master: "Fallout3.esm", folder: "Fallout3", original: true },
  fallout4: { master: "Fallout4.esm", folder: "Fallout4", original: false },
  fallout4vr: { master: "Fallout4.esm", folder: "Fallout4VR", original: false },
  falloutnv: { master: "FalloutNV.esm", folder: "falloutnv", original: true },
  oblivion: { master: "Oblivion.esm", folder: "oblivion", original: true },
  skyrim: { master: "Skyrim.esm", folder: "Skyrim", original: true },
  skyrimse: { master: "Skyrim.esm", folder: "Skyrim Special Edition", original: false },
  skyrimvr: { master: "Skyrim.esm", folder: "Skyrim VR", original: false },
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
    expect(ids.toSorted()).toEqual(Object.keys(gameFixtures).toSorted());
    expect(ids).not.toContain("starfield");
    expect(ids).not.toContain("oblivionremastered");
  });
  test.for(Object.entries(gameFixtures))(
    "round-trips the shared adapter and game files for %s",
    async ([gameId, { master: basePlugin, folder, original }], { makeGamebryo }) => {
      const root = await makeTempDir("vortex-manual-order-");
      const localAppData = path.join(root, "Local");
      const gameDir = path.join(root, "Game");
      const dataDir = path.join(gameDir, "Data");
      const gameFiles = path.join(localAppData, folder);
      const names = [basePlugin, "Alpha.esp", "Beta.esp"];
      await Promise.all([
        mkdir(dataDir, { recursive: true }),
        mkdir(gameFiles, { recursive: true }),
      ]);
      const harness = makeGamebryo({ gameId, gamePath: gameDir });
      await initGameSupport(harness.api);
      vi.stubEnv("LOCALAPPDATA", localAppData);
      onTestFinished(() => {
        vi.unstubAllEnvs();
      });
      const { restore } = installDiskFS();
      onTestFinished(restore);
      expect(pluginPath(gameId)).toBe(gameFiles);
      harness.api.store.dispatch(setAutoSortEnabled(false));
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
        await writeFile(path.join(dataDir, name), bytes);
      }
      harness.api.store.dispatch(
        setPluginList(
          Object.fromEntries(
            names.map((name) => [
              name.toLowerCase(),
              makePlugin({
                filePath: path.join(dataDir, name),
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

      const alpha = path.join(dataDir, "Alpha.esp");
      const beta = path.join(dataDir, "Beta.esp");
      await Promise.all([
        utimes(alpha, 1_600_000_000, 1_600_000_000),
        utimes(beta, 1_600_000_010, 1_600_000_010),
      ]);

      const header = "# Automatically generated by Vortex\r\n";
      const pluginFile = path.join(gameFiles, "plugins.txt");
      const orderFile = path.join(gameFiles, "loadorder.txt");
      await Promise.all([
        writeFile(
          pluginFile,
          header + (original ? "Alpha.esp\r\nBeta.esp\r\n" : "*Alpha.esp\r\n*Beta.esp\r\n"),
        ),
        writeFile(orderFile, header + names.join("\r\n")),
      ]);
      const writeError = vi.fn();
      const persistor = new PluginPersistor(writeError, () =>
        controlsPluginOrder(harness.getState()),
      );
      persistor.setResetCallback(() => Promise.resolve());
      try {
        await persistor.loadFiles(gameId);
        persistor.setKnownPlugins(
          Object.fromEntries(names.map((name) => [name.toLowerCase(), name])),
        );
        await persistor.syncFromState(gameId, harness.getGamebryoState().loadOrder);
        expect(writeError).not.toHaveBeenCalled();
        const entries = (file: string) =>
          readFile(file, "latin1").then((data) => data.split(/\r?\n/).slice(1).filter(Boolean));
        expect(await entries(orderFile)).toEqual([basePlugin, "Beta.esp", "Alpha.esp"]);
        expect(await entries(pluginFile)).toEqual(
          original ? [basePlugin, "Alpha.esp"] : ["Beta.esp", "*Alpha.esp"],
        );
        if (original) {
          const earlier = await stat(beta);
          const later = await stat(alpha);
          expect(earlier.mtimeMs).toBeLessThan(later.mtimeMs);
        }
      } finally {
        await persistor.disable();
      }
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
