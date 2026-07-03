import { describe, expect, test } from "vitest";

import { setPluginEnabled, setPluginOrder } from "../actions/loadOrder";
import { loadOrderReducer } from "./loadOrder";

// the reducer keys entries by action; redux-act actions stringify to their type, so index with the
// action itself. state is keyed by the plugin id (lowercased, ghost suffix stripped).
const setEnabled = loadOrderReducer.reducers[setPluginEnabled as any];
const setOrder = loadOrderReducer.reducers[setPluginOrder as any];

describe("loadOrder setPluginEnabled", () => {
  test("toggles an existing entry by id regardless of the payload's case", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: false, loadOrder: 3 } };

    const result = setEnabled(state, { pluginName: "SkyUI.esp", enabled: true });

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

    const result = setEnabled(state, { pluginName: "LegacyoftheDragonborn.esm", enabled: true });

    expect(result["legacyofthedragonborn.esm"].loadOrder).toBe(12);
    expect(result["legacyofthedragonborn.esm"].enabled).toBe(true);
  });

  test("matches an existing entry when the payload carries a ghost suffix", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: false, loadOrder: 3 } };

    const result = setEnabled(state, { pluginName: "SkyUI.esp.ghost", enabled: true });

    expect(Object.keys(result)).toEqual(["skyui.esp"]);
    expect(result["skyui.esp"].loadOrder).toBe(3);
  });

  test("inserts a brand-new plugin with loadOrder -1", () => {
    const result = setEnabled({}, { pluginName: "New.esp", enabled: true });

    expect(result["new.esp"]).toEqual({ name: "New.esp", enabled: true, loadOrder: -1 });
  });
});

describe("loadOrder setPluginOrder", () => {
  test("preserves a mixed-case plugin's enabled state across a full reorder", () => {
    const state = { "skyui.esp": { name: "SkyUI.esp", enabled: true, loadOrder: 0 } };

    const result = setOrder(state, { plugins: ["SkyUI.esp"], defaultEnable: false });

    expect(result["skyui.esp"]).toEqual({ name: "SkyUI.esp", enabled: true, loadOrder: 0 });
  });

  test("falls back to defaultEnable for plugins not previously known", () => {
    const result = setOrder({}, { plugins: ["Unseen.esp"], defaultEnable: true });

    expect(result["unseen.esp"]).toEqual({ name: "Unseen.esp", enabled: true, loadOrder: 0 });
  });
});
