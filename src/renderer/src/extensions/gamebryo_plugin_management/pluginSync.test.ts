import * as path from "node:path";

import { describe, expect, onTestFinished, vi } from "vitest";

import { settle } from "../../test-utils/async";
import { makeFakePersistor, makePlugin } from "../../test-utils/builders";
import {
  seedPluginDir,
  test,
  writePluginFile,
  type IGamebryoFixtures,
} from "../../test-utils/gamebryoTest";
import { makeTempDir } from "../../test-utils/tempDir";
import { setPluginOrder } from "./actions/loadOrder";
import { setPluginList } from "./actions/plugins";
import { makePluginSync, type IPluginSyncDeps } from "./pluginSync";
import { initGameSupport } from "./util/gameSupport";

// the rescan waits for the Data folder to stay quiet this long; the wait past it leaves room
// for the watcher to deliver and the file check to run
const REFRESH_DELAY_MS = 100;
const PAST_DEBOUNCE_MS = 300;

// a sync over a discovered game with an empty Data folder, answering every plugin-details
// request at once and recording what was asked
async function arrange(makeGamebryo: IGamebryoFixtures["makeGamebryo"], gameId?: string) {
  const root = await makeTempDir("vortex-plugin-sync-");
  const harness = makeGamebryo({ gameId, gamePath: path.join(root, "game") });
  const { dataPath } = harness;
  if (dataPath === undefined) {
    throw new Error("the harness resolves a data path once it is given a gamePath");
  }
  await Promise.all([initGameSupport(harness.api), seedPluginDir(dataPath, [])]);

  const persistors = {
    plugins: makeFakePersistor(),
    userlist: makeFakePersistor(),
    masterlist: makeFakePersistor(),
  };
  const deploying = { value: false };
  const updatePluginList = vi.fn<IPluginSyncDeps["updatePluginList"]>(() => Promise.resolve());
  const detailsRequests: string[][] = [];
  harness.api.events.on("plugin-details", (_gameId: string, ids: string[], cb: () => void) => {
    detailsRequests.push(ids);
    cb();
  });

  const sync = makePluginSync(harness.api, {
    persistors,
    isDeploying: () => deploying.value,
    updatePluginList,
    refreshDelayMs: REFRESH_DELAY_MS,
  });
  onTestFinished(() => sync.stop());

  return { harness, dataPath, persistors, deploying, updatePluginList, detailsRequests, sync };
}

describe("makePluginSync", () => {
  test("start clears the load order and loads the persistors for the active game", async ({
    makeGamebryo,
  }) => {
    const { harness, persistors, sync } = await arrange(makeGamebryo);
    harness.api.store.dispatch(setPluginOrder(["stale.esp"], true));

    await sync.start();

    expect(harness.getGamebryoState().loadOrder).toEqual({});
    expect(persistors.plugins.loadFiles).toHaveBeenCalledWith(harness.gameId);
    expect(persistors.userlist.loadFiles).toHaveBeenCalledWith(harness.gameId);
    expect(persistors.masterlist.loadFiles).toHaveBeenCalledWith(harness.gameId);
  });

  test("rescans the plugins once a new plugin appears in the Data folder", async ({
    makeGamebryo,
  }) => {
    const { dataPath, updatePluginList, sync } = await arrange(makeGamebryo);
    await sync.start();

    await writePluginFile(dataPath, "New.esp");

    await vi.waitFor(() => expect(updatePluginList).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  test("folds plugins appearing in quick succession into one rescan", async ({ makeGamebryo }) => {
    const { dataPath, updatePluginList, sync } = await arrange(makeGamebryo);
    await sync.start();

    await writePluginFile(dataPath, "One.esp");
    await writePluginFile(dataPath, "Two.esm");

    await vi.waitFor(() => expect(updatePluginList).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await settle(PAST_DEBOUNCE_MS);
    expect(updatePluginList).toHaveBeenCalledTimes(1);
  });

  test("leaves plugins appearing during a deployment to the deploy handler", async ({
    makeGamebryo,
  }) => {
    const { dataPath, deploying, updatePluginList, sync } = await arrange(makeGamebryo);
    await sync.start();
    deploying.value = true;

    await writePluginFile(dataPath, "Deployed.esp");
    await settle(PAST_DEBOUNCE_MS);

    expect(updatePluginList).not.toHaveBeenCalled();
  });

  test("ignores files in the Data folder that are not plugins", async ({ makeGamebryo }) => {
    const { dataPath, updatePluginList, sync } = await arrange(makeGamebryo);
    await sync.start();

    await writePluginFile(dataPath, "readme.txt");
    await settle(PAST_DEBOUNCE_MS);

    expect(updatePluginList).not.toHaveBeenCalled();
  });

  test("stop disables the persistor and stops watching the Data folder", async ({
    makeGamebryo,
  }) => {
    const { dataPath, persistors, updatePluginList, sync } = await arrange(makeGamebryo);
    await sync.start();

    await sync.stop();

    expect(persistors.plugins.disable).toHaveBeenCalledTimes(1);
    await writePluginFile(dataPath, "Late.esp");
    await settle(PAST_DEBOUNCE_MS);
    expect(updatePluginList).not.toHaveBeenCalled();
  });

  test("refresh rescans the active profile and requests details for the listed plugins", async ({
    makeGamebryo,
  }) => {
    const { harness, updatePluginList, detailsRequests, sync } = await arrange(makeGamebryo);
    harness.api.store.dispatch(setPluginList({ "one.esp": makePlugin() }));

    await sync.refresh();

    const profile = harness.getState().persistent.profiles[harness.profileId];
    expect(updatePluginList).toHaveBeenCalledWith(
      expect.anything(),
      profile.modState,
      harness.gameId,
    );
    expect(detailsRequests).toEqual([["one.esp"]]);
  });

  test("refresh does nothing for a game without plugin management", async ({ makeGamebryo }) => {
    const { updatePluginList, detailsRequests, sync } = await arrange(
      makeGamebryo,
      "cyberpunk2077",
    );

    await sync.refresh();

    expect(updatePluginList).not.toHaveBeenCalled();
    expect(detailsRequests).toEqual([]);
  });
});
