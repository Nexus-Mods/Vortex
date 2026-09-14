import * as path from "path";

import { describe, expect, vi } from "vitest";

import { makeMod, makePlugin, setCollectionSession } from "../../../test-utils/builders";
import { test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../../test-utils/harnessTypes";
import type * as fsModule from "../../../util/fs";
import { setPluginList } from "../actions/plugins";
import { handleModInstalled } from "./onModInstalled";

const { readdirAsyncMock } = vi.hoisted(() => ({
  readdirAsyncMock: vi.fn<(...args: unknown[]) => Promise<string[]>>(),
}));

// gameSupported consults a module-level api handle (set at extension init) for the
// games whose plugin management is toggleable; pin the answers instead
vi.mock("./gameSupport", () => ({
  gameSupported: (gameMode: string) => gameMode === "skyrimse",
  isNativePlugin: () => false,
}));

// staging-folder scan without disk
vi.mock("../../../util/fs", async (importOriginal) => ({
  ...(await importOriginal<typeof fsModule>()),
  readdirAsync: readdirAsyncMock,
}));

// only real plugin extensions survive the scan; the entry module injects its own check, which
// additionally stats the file - this fake deliberately skips the existence check so the merge
// logic is observable on its own
const isPlugin = (_filePath: string, fileName: string, _gameMode: string): Promise<boolean> =>
  Promise.resolve(fileName.toLowerCase().endsWith(".esp"));

function arrange(
  makeGamebryo: IGamebryoFixtures["makeGamebryo"],
  inSession: boolean,
): IGamebryoHarness {
  const mod = makeMod({ id: "modX", installationPath: "modX" });
  const harness = makeGamebryo({ mods: { [mod.id]: mod } });
  setCollectionSession(harness, inSession);
  return harness;
}

describe("handleModInstalled", () => {
  test("merges staged plugins into the plugin list during a collection install", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, true);
    readdirAsyncMock.mockResolvedValue(["One.esp", "readme.txt"]);

    await handleModInstalled(harness.api, "skyrimse", "modX", isPlugin);

    expect(harness.pluginList()).toEqual({
      "one.esp": {
        modId: "modX",
        filePath: path.join(harness.stagingPath, "modX", "One.esp"),
        isNative: false,
        warnings: {},
        deployed: false,
      },
    });
  });

  test("leaves the plugin list untouched outside a collection session", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, false);
    readdirAsyncMock.mockResolvedValue(["One.esp"]);

    await handleModInstalled(harness.api, "skyrimse", "modX", isPlugin);

    expect(readdirAsyncMock).not.toHaveBeenCalled();
    expect(harness.pluginList()).toEqual({});
  });

  test("leaves the plugin list untouched for a mod without a staging folder", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, true);

    await handleModInstalled(harness.api, "skyrimse", "unknown-mod", isPlugin);

    expect(readdirAsyncMock).not.toHaveBeenCalled();
    expect(harness.pluginList()).toEqual({});
  });

  test("keeps existing plugin entries over staged duplicates", async ({ makeGamebryo }) => {
    const harness = arrange(makeGamebryo, true);
    const existing = makePlugin({ modId: "earlier-mod" });
    harness.api.store.dispatch(setPluginList({ "one.esp": existing }));
    readdirAsyncMock.mockResolvedValue(["One.esp", "Two.esp"]);

    await handleModInstalled(harness.api, "skyrimse", "modX", isPlugin);

    const pluginList = harness.pluginList();
    expect(pluginList["one.esp"]).toEqual(existing);
    expect(pluginList["two.esp"]).toEqual(expect.objectContaining({ modId: "modX" }));
  });

  test("keeps the merged plugin list intact when a later staging folder is unreadable", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, true);
    const existing = makePlugin({ modId: "earlier-mod" });
    harness.api.store.dispatch(setPluginList({ "one.esp": existing }));
    readdirAsyncMock.mockRejectedValue(new Error("EPERM"));

    await handleModInstalled(harness.api, "skyrimse", "modX", isPlugin);

    expect(harness.pluginList()).toEqual({
      "one.esp": existing,
    });
  });
});
