import * as path from "node:path";

import { afterEach, describe, expect, vi } from "vitest";

import { makePlugin } from "../../../test-utils/builders";
import { test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import { makeTempDir } from "../../../test-utils/tempDir";
import { setPluginList } from "../actions/plugins";
import { ESPFile } from "../esp/ESPFile";
import { makeSetPluginLight } from "./pluginLight";

const PLUGIN_ID = "held.esp";

// the game, xEdit or an antivirus scanner has the deployed plugin open
const held = (): NodeJS.ErrnoException => {
  const err: NodeJS.ErrnoException = new Error("EBUSY: resource busy or locked, open");
  err.code = "EBUSY";
  return err;
};

/** A harness whose plugin list holds one deployed plugin in the game's Data folder. */
async function arrange(makeGamebryo: IGamebryoFixtures["makeGamebryo"]) {
  const harness = makeGamebryo({ gamePath: await makeTempDir("vortex-light-") });
  if (harness.dataPath === undefined) {
    throw new Error("the harness resolves a data path once it is given a gamePath");
  }
  const filePath = path.join(harness.dataPath, "Held.esp");
  harness.api.store.dispatch(setPluginList({ [PLUGIN_ID]: makePlugin({ filePath }) }));
  return harness;
}

describe("setPluginLight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("tells the user the file is in use instead of failing unhandled", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo);
    vi.spyOn(ESPFile, "open").mockRejectedValue(held());
    const onChanged = vi.fn();
    const setPluginLight = makeSetPluginLight(harness.api, onChanged);

    await expect(setPluginLight(PLUGIN_ID, true)).resolves.toBeUndefined();

    expect(harness.errorNotifications).toHaveLength(1);
    // the user can free the file themselves, so there is nothing for us to receive a report on
    expect(harness.errorNotifications[0].allowReport).toBe(false);
    expect(harness.historyEntries).toHaveLength(0);
    expect(onChanged).not.toHaveBeenCalled();
  });

  test("keeps a failure that is not a held file reportable", async ({ makeGamebryo }) => {
    const harness = await arrange(makeGamebryo);
    vi.spyOn(ESPFile, "open").mockRejectedValue(new Error("not a plugin"));
    const setPluginLight = makeSetPluginLight(harness.api, vi.fn());

    await expect(setPluginLight(PLUGIN_ID, true)).resolves.toBeUndefined();

    expect(harness.errorNotifications).toHaveLength(1);
    expect(harness.errorNotifications[0].allowReport).not.toBe(false);
  });

  test("records the change and refreshes the plugin once the flag is written", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo);
    const setLightFlag = vi.fn(() => Promise.resolve());
    vi.spyOn(ESPFile, "open").mockResolvedValue({ setLightFlag } as unknown as ESPFile);
    const onChanged = vi.fn();
    const setPluginLight = makeSetPluginLight(harness.api, onChanged);

    await setPluginLight(PLUGIN_ID, true);

    expect(setLightFlag).toHaveBeenCalledWith(true);
    expect(harness.historyEntries).toHaveLength(1);
    expect(onChanged).toHaveBeenCalledWith(PLUGIN_ID);
    expect(harness.errorNotifications).toHaveLength(0);
  });
});
