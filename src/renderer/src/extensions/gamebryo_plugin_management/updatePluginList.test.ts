import * as path from "node:path";

import { describe, expect } from "vitest";

import { startActivity, stopActivity } from "../../actions/session";
import { makeMod, makePlugin } from "../../test-utils/builders";
import { seedPluginDir, test, type IGamebryoFixtures } from "../../test-utils/gamebryoTest";
import { makeTempDir } from "../../test-utils/tempDir";
import { setDeploymentNecessary } from "../mod_management/actions/deployment";
import type { IMod } from "../mod_management/types/IMod";
import { setPluginList } from "./actions/plugins";
import { updatePluginList } from "./index";
import { initGameSupport } from "./util/gameSupport";

interface IScenario {
  // plugin files staged per mod (the mod id doubles as its staging folder name); null seeds the
  // mod without a folder on disk
  staged: Record<string, string[] | null>;
  // plugin files already present in the game's data folder
  deployed?: string[];
  // mods the update's mod list marks disabled
  disabled?: string[];
  // fileOverrides per mod id
  fileOverrides?: Record<string, string[]>;
}

async function arrange(makeGamebryo: IGamebryoFixtures["makeGamebryo"], spec: IScenario) {
  const root = await makeTempDir("vortex-plugins-");
  const staging = path.join(root, "staging");
  const gamePath = path.join(root, "game");
  // keyed by mod id
  const mods: Record<string, IMod> = {};
  for (const modId of Object.keys(spec.staged)) {
    mods[modId] = makeMod({
      id: modId,
      installationPath: modId,
      fileOverrides: spec.fileOverrides?.[modId],
    });
  }
  const harness = makeGamebryo({ mods, installPath: { skyrimse: staging }, gamePath });
  const { dataPath } = harness;
  if (dataPath === undefined) {
    throw new Error("the harness resolves a data path once it is given a gamePath");
  }
  await Promise.all([
    initGameSupport(harness.api),
    seedPluginDir(dataPath, spec.deployed ?? []),
    ...Object.entries(spec.staged)
      .filter((entry): entry is [string, string[]] => entry[1] !== null)
      .map(([modId, files]) => seedPluginDir(path.join(staging, modId), files)),
  ]);
  const modList = Object.fromEntries(
    Object.keys(mods).map((modId) => [modId, { enabled: !(spec.disabled ?? []).includes(modId) }]),
  );
  return {
    harness,
    dataPath,
    // the scan under test, against the seeded mods and the harness game
    scan: () => updatePluginList(harness.api.store, modList, harness.gameId),
  };
}

describe("updatePluginList", () => {
  test("lists staged and deployed plugins with their deployed flags", async ({ makeGamebryo }) => {
    const { harness, dataPath, scan } = await arrange(makeGamebryo, {
      staged: { modX: ["One.esp", "Two.esp", "readme.txt"] },
      deployed: ["One.esp", "Vanilla.esm"],
    });

    await scan();

    expect(harness.pluginList()).toEqual({
      "one.esp": {
        modId: "modX",
        filePath: path.join(dataPath, "One.esp"),
        isNative: false,
        warnings: {},
        deployed: true,
      },
      "two.esp": {
        modId: "modX",
        filePath: path.join(harness.stagingPath, "modX", "Two.esp"),
        isNative: false,
        warnings: {},
        deployed: false,
      },
      "vanilla.esm": {
        modId: "",
        filePath: path.join(dataPath, "Vanilla.esm"),
        isNative: false,
        warnings: {},
        deployed: true,
      },
    });
  });

  test("skips the plugins of disabled mods", async ({ makeGamebryo }) => {
    const { harness, scan } = await arrange(makeGamebryo, {
      staged: { modX: ["One.esp"], modY: ["Two.esp"] },
      disabled: ["modY"],
    });

    await scan();

    expect(Object.keys(harness.pluginList())).toEqual(["one.esp"]);
  });

  test("skips the plugins a mod's file overrides exclude", async ({ makeGamebryo }) => {
    const { harness, scan } = await arrange(makeGamebryo, {
      staged: { modX: ["One.esp", "Two.esp"] },
      fileOverrides: { modX: ["One.esp"] },
    });

    await scan();

    expect(Object.keys(harness.pluginList())).toEqual(["two.esp"]);
  });

  test("carries the existing warnings of a plugin into its refreshed entry", async ({
    makeGamebryo,
  }) => {
    const { harness, scan } = await arrange(makeGamebryo, { staged: { modX: ["One.esp"] } });
    harness.api.store.dispatch(
      setPluginList({ "one.esp": makePlugin({ warnings: { "missing-master": true } }) }),
    );

    await scan();

    expect(harness.pluginList()["one.esp"].warnings).toEqual({ "missing-master": true });
  });

  test("flags a deployment as necessary when a staged plugin is not deployed", async ({
    makeGamebryo,
  }) => {
    const { harness, scan } = await arrange(makeGamebryo, { staged: { modX: ["Two.esp"] } });

    await scan();

    expect(harness.dispatched).toContainEqual(setDeploymentNecessary("skyrimse", true));
  });

  test("leaves the deployment flag alone when every plugin is deployed", async ({
    makeGamebryo,
  }) => {
    const { harness, scan } = await arrange(makeGamebryo, {
      staged: { modX: ["One.esp"] },
      deployed: ["One.esp"],
    });

    await scan();

    expect(harness.pluginList()["one.esp"].deployed).toBe(true);
    expect(harness.dispatched).not.toContainEqual(setDeploymentNecessary("skyrimse", true));
  });

  test("keeps scanning when a mod folder is unreadable", async ({ makeGamebryo }) => {
    const { harness, scan } = await arrange(makeGamebryo, {
      staged: { modX: ["Two.esp"], modGone: null },
    });

    await scan();

    expect(Object.keys(harness.pluginList())).toEqual(["two.esp"]);
  });

  test("wraps the scan in the update-plugin-list activity", async ({ makeGamebryo }) => {
    const { harness, scan } = await arrange(makeGamebryo, { staged: { modX: ["One.esp"] } });

    await scan();

    expect(harness.dispatched).toContainEqual(startActivity("plugins", "update-plugin-list"));
    expect(harness.dispatched).toContainEqual(stopActivity("plugins", "update-plugin-list"));
  });
});
