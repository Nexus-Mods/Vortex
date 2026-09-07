import { describe, expect, vi } from "vitest";

// gameSupported consults a module-level api handle (set at extension init) for the
// games whose plugin management is toggleable; pin the answers instead
vi.mock("./gameSupport", () => ({
  gameSupported: (gameMode: string) => gameMode === "skyrimse",
  pluginExtensions: () => [".esp", ".esm", ".esl"],
}));

import { setPluginEnabled } from "../actions/loadOrder";
import {
  dispatchedActions,
  makeExtensionApi,
  makeMod,
  vortexApiTest as test,
  type IExtensionApiDouble,
  type IVortexApiDoubles,
} from "../test-utils/vortexApiTest";
import { handleModEnabled } from "./onModEnabled";

function arrange(vortexApi: IVortexApiDoubles, pluginFiles: string[]): IExtensionApiDouble {
  vortexApi.activeProfile.mockReturnValue({ id: "p1", gameId: "skyrimse" });
  vortexApi.installPath.mockReturnValue("staging");
  vortexApi.getCollectionActiveSession.mockReturnValue(undefined);
  vortexApi.readdirAsync.mockResolvedValue(pluginFiles);
  const mod = makeMod({ id: "modX", installationPath: "modX" });
  return makeExtensionApi({ persistent: { mods: { skyrimse: { [mod.id]: mod } } } });
}

describe("handleModEnabled", () => {
  test("enables the plugin of a single-plugin mod", async ({ vortexApi }) => {
    const api = arrange(vortexApi, ["One.esp"]);

    await handleModEnabled(api as never, "p1", "modX");

    expect(dispatchedActions(api.store.dispatch)).toContainEqual(setPluginEnabled("One.esp", true));
    expect(api.sendNotification).not.toHaveBeenCalled();
  });

  test("only notifies for a multi-plugin mod outside a collection install", async ({
    vortexApi,
  }) => {
    const api = arrange(vortexApi, ["One.esp", "Two.esp"]);

    await handleModEnabled(api as never, "p1", "modX");

    const enables = dispatchedActions(api.store.dispatch).filter(
      (action) => action.type === "SET_PLUGIN_ENABLED",
    );
    expect(enables).toEqual([]);
    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "multiple-plugins-modX" }),
    );
  });

  test("enables ALL plugins of a multi-plugin mod during a collection install", async ({
    vortexApi,
  }) => {
    const api = arrange(vortexApi, ["One.esp", "Two.esp"]);
    vortexApi.getCollectionActiveSession.mockReturnValue({ sessionId: "s1", collectionId: "c1" });

    await handleModEnabled(api as never, "p1", "modX");

    const dispatched = dispatchedActions(api.store.dispatch);
    expect(dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    expect(dispatched).toContainEqual(setPluginEnabled("Two.esp", true));
    expect(api.sendNotification).not.toHaveBeenCalled();
  });

  test("still enables all plugins when the session ends during the directory read", async ({
    vortexApi,
  }) => {
    const api = arrange(vortexApi, []);
    vortexApi.getCollectionActiveSession.mockReturnValue({ sessionId: "s1", collectionId: "c1" });
    vortexApi.readdirAsync.mockImplementation(() => {
      // the collection session completes while the readdir is in flight
      vortexApi.getCollectionActiveSession.mockReturnValue(undefined);
      return Promise.resolve(["One.esp", "Two.esp"]);
    });

    await handleModEnabled(api as never, "p1", "modX");

    const dispatched = dispatchedActions(api.store.dispatch);
    expect(dispatched).toContainEqual(setPluginEnabled("One.esp", true));
    expect(dispatched).toContainEqual(setPluginEnabled("Two.esp", true));
    expect(api.sendNotification).not.toHaveBeenCalled();
  });

  test("enables the single plugin during a collection install as before", async ({ vortexApi }) => {
    const api = arrange(vortexApi, ["One.esp"]);
    vortexApi.getCollectionActiveSession.mockReturnValue({ sessionId: "s1", collectionId: "c1" });

    await handleModEnabled(api as never, "p1", "modX");

    expect(dispatchedActions(api.store.dispatch)).toContainEqual(setPluginEnabled("One.esp", true));
    expect(api.sendNotification).not.toHaveBeenCalled();
  });
});
