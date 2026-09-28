import { describe, expect } from "vitest";

import { test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness, IGamebryoHarnessOpts } from "../../../test-utils/harnessTypes";
import { setPluginManagementEnabled } from "../actions/settings";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";
import { gameSupported, initGameSupport, knownGame, pluginManagementEnabled } from "./gameSupport";

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
    harness.api.store.dispatch(setPluginManagementEnabled(harness.profileId, false));
    expect(gameSupported("skyrimse")).toBe(false);
    expect(knownGame("skyrimse")).toBe(true);
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
    expect(knownGame("cyberpunk2077")).toBe(false);
  });
});

describe("pluginManagementEnabled", () => {
  test("reads the given profile's toggle", async ({ makeGamebryo }) => {
    const harness = await arrange(makeGamebryo);

    harness.api.store.dispatch(setPluginManagementEnabled(harness.profileId, false));

    expect(pluginManagementEnabled(harness.api.getState(), "skyrimse", harness.profileId)).toBe(
      false,
    );
  });

  test("falls back to the game's default for a profile that never set the toggle", async ({
    makeGamebryo,
  }) => {
    const harness = await arrange(makeGamebryo);
    const state = harness.api.getState<IStateWithGamebryo>();

    expect(pluginManagementEnabled(state, "skyrimse", harness.profileId)).toBe(true);
    expect(pluginManagementEnabled(state, "starfield", harness.profileId)).toBe(false);
  });
});
