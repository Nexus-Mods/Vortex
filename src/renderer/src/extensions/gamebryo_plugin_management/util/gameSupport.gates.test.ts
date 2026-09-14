import { describe, expect } from "vitest";

import { test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness, IGamebryoHarnessOpts } from "../../../test-utils/harnessTypes";
import { setPluginManagementEnabled } from "../actions/settings";
import { gameSupported, initGameSupport } from "./gameSupport";

// gameSupported consults the api handed to initGameSupport, so every harness runs the init first
async function arrange(
  makeGamebryo: IGamebryoFixtures["makeGamebryo"],
  opts?: IGamebryoHarnessOpts,
): Promise<IGamebryoHarness> {
  const harness = makeGamebryo(opts);
  await initGameSupport(harness.api);
  return harness;
}

describe("gameSupported gates", () => {
  test("honors the profile's plugin-management toggle", async ({ makeGamebryo }) => {
    const harness = await arrange(makeGamebryo);

    expect(gameSupported("skyrimse")).toBe(true);
    expect(gameSupported("skyrimse", true)).toBe(true);
    harness.api.store.dispatch(setPluginManagementEnabled(harness.profileId, false));
    expect(gameSupported("skyrimse")).toBe(false);
  });

  test("defaults plugin management off for starfield until the profile opts in", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo, { gameId: "starfield" });

    expect(gameSupported("starfield")).toBe(false);
    harness.api.store.dispatch(setPluginManagementEnabled(harness.profileId, true));
    expect(gameSupported("starfield")).toBe(true);
  });

  test("defaults plugin management off for oblivionremastered", async ({ makeGamebryo }) => {
    await arrange(makeGamebryo, { gameId: "oblivionremastered" });

    expect(gameSupported("oblivionremastered")).toBe(false);
  });

  test("never supports games outside the support table", async ({ makeGamebryo }) => {
    await arrange(makeGamebryo);

    expect(gameSupported("cyberpunk2077")).toBe(false);
    expect(gameSupported("cyberpunk2077", true)).toBe(false);
  });

  // the desired contract from LAZ-1047: "populate and sort paths agree on whether plugin
  // management is active for the profile" - the sort form ignores the toggle, so LOOT sorts a
  // loadOrder hive the populate paths never hydrate ("No plugins to sort" on default Starfield)
  test.fails("answers the populate and sort paths the same when plugin management is disabled", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo);
    harness.api.store.dispatch(setPluginManagementEnabled(harness.profileId, false));

    expect(gameSupported("starfield", true)).toBe(gameSupported("starfield"));
  });
});
