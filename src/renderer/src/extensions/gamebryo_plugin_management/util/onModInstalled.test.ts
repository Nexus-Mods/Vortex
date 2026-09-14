import * as path from "node:path";

import { describe, expect } from "vitest";

import { makeMod, makePlugin, setCollectionSession } from "../../../test-utils/builders";
import { seedPluginDir, test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../../test-utils/harnessTypes";
import { makeTempDir } from "../../../test-utils/tempDir";
import { setPluginList } from "../actions/plugins";
import { initGameSupport } from "./gameSupport";
import { handleModInstalled } from "./onModInstalled";

// mod "modX" staged in a real temp folder (null: no folder on disk), in or out of a session
async function arrange(
  makeGamebryo: IGamebryoFixtures["makeGamebryo"],
  inSession: boolean,
  staged: string[] | null = ["One.esp", "readme.txt"],
): Promise<IGamebryoHarness> {
  const staging = await makeTempDir("vortex-merge-");
  const mod = makeMod({ id: "modX", installationPath: "modX" });
  if (staged !== null) {
    await seedPluginDir(path.join(staging, mod.id), staged);
  }
  const harness = makeGamebryo({ mods: { [mod.id]: mod }, installPath: { skyrimse: staging } });
  await initGameSupport(harness.api);
  setCollectionSession(harness, inSession);
  return harness;
}

describe("handleModInstalled", () => {
  test("merges staged plugins into the plugin list during a collection install", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo, true);

    await handleModInstalled(harness.api, "skyrimse", "modX");

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
    const harness = await arrange(makeGamebryo, false);

    await handleModInstalled(harness.api, "skyrimse", "modX");

    expect(harness.pluginList()).toEqual({});
  });

  test("leaves the plugin list untouched for a mod it does not know", async ({ makeGamebryo }) => {
    const harness = await arrange(makeGamebryo, true);

    await handleModInstalled(harness.api, "skyrimse", "unknown-mod");

    expect(harness.pluginList()).toEqual({});
  });

  test("keeps existing plugin entries over staged duplicates", async ({ makeGamebryo }) => {
    const harness = await arrange(makeGamebryo, true, ["One.esp", "Two.esp"]);
    const existing = makePlugin({ modId: "earlier-mod" });
    harness.api.store.dispatch(setPluginList({ "one.esp": existing }));

    await handleModInstalled(harness.api, "skyrimse", "modX");

    const pluginList = harness.pluginList();
    expect(pluginList["one.esp"]).toEqual(existing);
    expect(pluginList["two.esp"]).toEqual(expect.objectContaining({ modId: "modX" }));
  });

  test("keeps the merged plugin list intact when a staging folder is missing", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo, true, null);
    const existing = makePlugin({ modId: "earlier-mod" });
    harness.api.store.dispatch(setPluginList({ "one.esp": existing }));

    await handleModInstalled(harness.api, "skyrimse", "modX");

    expect(harness.pluginList()).toEqual({ "one.esp": existing });
  });
});
