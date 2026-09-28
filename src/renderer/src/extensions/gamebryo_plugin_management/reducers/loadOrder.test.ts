import { describe, expect, test } from "vitest";

import { setPluginEnabled, setPluginOrder, updatePluginOrder } from "../actions/loadOrder";
import { loadOrderReducer } from "./loadOrder";

// drive the reducer through the real action creators so the payload shapes under test
// stay the ones production dispatches. state is keyed by the plugin id (lowercased,
// ghost suffix stripped).
function reduce(state: unknown, action: { type: string; payload: unknown }) {
  return loadOrderReducer.reducers[action.type](state, action.payload);
}

describe("loadOrder setPluginEnabled", () => {
  test("toggles an existing entry by id regardless of the payload's case", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: false, loadOrder: 3 } };

    const result = reduce(state, setPluginEnabled("SkyUI.esp", true));

    // existing entry is updated in place: enabled flips, load order is preserved.
    expect(result["skyui.esp"]).toEqual({ name: "SkyUI.esp", enabled: true, loadOrder: 3 });
  });

  test("does not reset an existing mixed-case entry's load order to -1", () => {
    const state = {
      "legacyofthedragonborn.esm": {
        name: "LegacyoftheDragonborn.esm",
        enabled: false,
        loadOrder: 12,
      },
    };

    const result = reduce(state, setPluginEnabled("LegacyoftheDragonborn.esm", true));

    expect(result["legacyofthedragonborn.esm"].loadOrder).toBe(12);
    expect(result["legacyofthedragonborn.esm"].enabled).toBe(true);
  });

  test("matches an existing entry when the payload carries a ghost suffix", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: false, loadOrder: 3 } };

    const result = reduce(state, setPluginEnabled("SkyUI.esp.ghost", true));

    expect(Object.keys(result)).toEqual(["skyui.esp"]);
    expect(result["skyui.esp"].loadOrder).toBe(3);
  });

  test("inserts a brand-new plugin with loadOrder -1", () => {
    const result = reduce({}, setPluginEnabled("New.esp", true));

    expect(result["new.esp"]).toEqual({ name: "New.esp", enabled: true, loadOrder: -1 });
  });
});

describe("loadOrder setPluginOrder", () => {
  test("preserves a mixed-case plugin's enabled state across a full reorder", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: true, loadOrder: 0 } };

    const result = reduce(state, setPluginOrder(["SkyUI.esp"], false));

    expect(result["skyui.esp"]).toEqual({ name: "SkyUI.esp", enabled: true, loadOrder: 0 });
  });

  test("falls back to defaultEnable for plugins not previously known", () => {
    const result = reduce({}, setPluginOrder(["Unseen.esp"], true));

    expect(result["unseen.esp"]).toEqual({ name: "Unseen.esp", enabled: true, loadOrder: 0 });
  });

  test("an empty list clears every entry (the profile-switch clean slate)", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: true, loadOrder: 0 } };

    const result = reduce(state, setPluginOrder([], false));

    expect(result).toEqual({});
  });
});

describe("loadOrder updatePluginOrder", () => {
  test("orders the listed plugins and appends unlisted entries after them", () => {
    const state = {
      "a.esp": { name: "A.esp", enabled: true, loadOrder: 5 },
      "b.esp": { name: "B.esp", enabled: false, loadOrder: 0 },
    };

    const result = reduce(state, updatePluginOrder(["B.esp"], false, false));

    expect(result["b.esp"].loadOrder).toBe(0);
    expect(result["a.esp"].loadOrder).toBe(1);
    expect(result["a.esp"].enabled).toBe(true);
  });

  test("setEnabled enables the listed plugins and disables the rest", () => {
    const state = {
      "a.esp": { name: "A.esp", enabled: true, loadOrder: 0 },
      "b.esp": { name: "B.esp", enabled: false, loadOrder: 1 },
    };

    const result = reduce(state, updatePluginOrder(["B.esp"], true, false));

    expect(result["b.esp"].enabled).toBe(true);
    expect(result["a.esp"].enabled).toBe(false);
  });

  test("falls back to defaultEnable for plugins not previously known", () => {
    const result = reduce({}, updatePluginOrder(["New.esp"], false, true));

    expect(result["new.esp"]).toEqual({ name: "New.esp", enabled: true, loadOrder: 0 });
  });

  test("matches existing entries by id regardless of the list's case", () => {
    const state = { "skyui.esp": { name: "skyui.esp", enabled: true, loadOrder: 4 } };

    const result = reduce(state, updatePluginOrder(["SkyUI.esp"], false, false));

    expect(Object.keys(result)).toEqual(["skyui.esp"]);
    expect(result["skyui.esp"]).toEqual({ name: "SkyUI.esp", enabled: true, loadOrder: 0 });
  });
});
