import { describe, expect, vi } from "vitest";

import { makeMod, makeSession } from "../../../test-utils/builders";
import { test, type IGamebryoFixtures } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../../test-utils/harnessTypes";
import type * as fsModule from "../../../util/fs";
import { setPluginEnabled } from "../actions/loadOrder";
import { handleModEnabled } from "./onModEnabled";

const { readdirAsyncMock } = vi.hoisted(() => ({
  readdirAsyncMock: vi.fn<(...args: unknown[]) => Promise<string[]>>(),
}));

// gameSupported consults a module-level api handle (set at extension init) for the
// games whose plugin management is toggleable; pin the answers instead
vi.mock("./gameSupport", () => ({
  gameSupported: (gameMode: string) => gameMode === "skyrimse",
  pluginExtensions: () => [".esp", ".esm", ".esl"],
}));

// staging-folder scan without disk
vi.mock("../../../util/fs", async (importOriginal) => ({
  ...(await importOriginal<typeof fsModule>()),
  readdirAsync: readdirAsyncMock,
}));

function arrange(
  makeGamebryo: IGamebryoFixtures["makeGamebryo"],
  pluginFiles: string[],
): IGamebryoHarness {
  const mod = makeMod({ id: "modX", installationPath: "modX" });
  const harness = makeGamebryo({ mods: { [mod.id]: mod } });
  readdirAsyncMock.mockResolvedValue(pluginFiles);
  return harness;
}

function setCollectionSession(harness: IGamebryoHarness, active: boolean): void {
  harness.setState((draft) => {
    draft.session.collections.activeSession = active ? makeSession() : undefined;
  });
}

describe("handleModEnabled", () => {
  test("enables the plugin of a single-plugin mod", async ({ makeGamebryo }) => {
    const harness = arrange(makeGamebryo, ["One.esp"]);

    await handleModEnabled(harness.api, harness.profileId, "modX");

    expect(harness.dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    // the bound loadOrder reducer applied the write, so it reads back from the hive
    expect(harness.getGamebryoState().loadOrder["one.esp"]?.enabled).toBe(true);
    expect(harness.notifications).toEqual([]);
  });

  test("only notifies for a multi-plugin mod outside a collection install", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, ["One.esp", "Two.esp"]);

    await handleModEnabled(harness.api, harness.profileId, "modX");

    const enables = harness.dispatched.filter((action) => action.type === "SET_PLUGIN_ENABLED");
    expect(enables).toEqual([]);
    expect(harness.notifications).toContainEqual(
      expect.objectContaining({ id: "multiple-plugins-modX" }),
    );
  });

  test("enables ALL plugins of a multi-plugin mod during a collection install", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, ["One.esp", "Two.esp"]);
    setCollectionSession(harness, true);

    await handleModEnabled(harness.api, harness.profileId, "modX");

    expect(harness.dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    expect(harness.dispatched).toContainEqual(setPluginEnabled("Two.esp", true));
    expect(harness.notifications).toEqual([]);
  });

  test("still enables all plugins when the session ends during the directory read", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, []);
    setCollectionSession(harness, true);
    readdirAsyncMock.mockImplementation(() => {
      // the collection session completes while the readdir is in flight
      setCollectionSession(harness, false);
      return Promise.resolve(["One.esp", "Two.esp"]);
    });

    await handleModEnabled(harness.api, harness.profileId, "modX");

    expect(harness.dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    expect(harness.dispatched).toContainEqual(setPluginEnabled("Two.esp", true));
    expect(harness.notifications).toEqual([]);
  });

  test("enables the single plugin during a collection install as before", async ({
    makeGamebryo,
  }) => {
    const harness = arrange(makeGamebryo, ["One.esp"]);
    setCollectionSession(harness, true);

    await handleModEnabled(harness.api, harness.profileId, "modX");

    expect(harness.dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    expect(harness.notifications).toEqual([]);
  });
});
