import { describe, expect, test } from "vitest";

import * as actions from "../actions/plugins";
import { pluginsReducer } from "./plugins";

// invoke a single case of the reducer spec by the action it handles
function reduce(state: unknown, action: { type: string; payload: unknown }) {
  return pluginsReducer.reducers[action.type](state, action.payload);
}

const initial = () => ({ ...pluginsReducer.defaults });

describe("pluginsReducer", () => {
  describe("setPluginList", () => {
    test("stores the provided plugin map", () => {
      const plugins = { "a.esp": { name: "a.esp", enabled: true } };

      const next = reduce(initial(), actions.setPluginList(plugins as any));

      expect(next.pluginList).toEqual(plugins);
    });

    test("replaces any existing plugin list", () => {
      const state = { ...initial(), pluginList: { "old.esp": { name: "old.esp" } } };

      const next = reduce(state, actions.setPluginList({ "new.esp": { name: "new.esp" } } as any));

      expect(next.pluginList).toEqual({ "new.esp": { name: "new.esp" } });
    });

    test("resets pluginList to {} when passed undefined rather than leaving it undefined", () => {
      const next = reduce(initial(), actions.setPluginList(undefined));

      expect(next.pluginList).toEqual({});
    });
  });

  describe("setPluginInfo", () => {
    test("stores the provided plugin info map", () => {
      const info = { "a.esp": { name: "a.esp", filePath: "C:/a.esp" } };

      const next = reduce(initial(), actions.setPluginInfo(info as any));

      expect(next.pluginInfo).toEqual(info);
    });
  });

  describe("setPluginFilePath", () => {
    test("sets filePath on both pluginList and pluginInfo, preserving other fields", () => {
      const state = {
        ...initial(),
        pluginList: { "a.esp": { name: "a.esp", enabled: true } },
        pluginInfo: { "a.esp": { name: "a.esp" } },
      };

      const next = reduce(state, actions.setPluginFilePath("a.esp", "C:/a.esp"));

      expect(next.pluginList["a.esp"]).toEqual({
        name: "a.esp",
        enabled: true,
        filePath: "C:/a.esp",
      });
      expect(next.pluginInfo["a.esp"]).toEqual({ name: "a.esp", filePath: "C:/a.esp" });
    });

    test("creates the entry when the plugin is not yet present", () => {
      const next = reduce(initial(), actions.setPluginFilePath("a.esp", "C:/a.esp"));

      expect(next.pluginList["a.esp"]).toEqual({ filePath: "C:/a.esp" });
      expect(next.pluginInfo["a.esp"]).toEqual({ filePath: "C:/a.esp" });
    });
  });

  describe("updatePluginWarnings", () => {
    test("sets the warning flag on an existing plugin", () => {
      const state = { ...initial(), pluginList: { "a.esp": { name: "a.esp" } } };

      const next = reduce(state, actions.updatePluginWarnings("a.esp", "missing-master", true));

      expect(next.pluginList["a.esp"].warnings).toEqual({ "missing-master": true });
      expect(next.pluginList["a.esp"].name).toBe("a.esp");
    });

    test("leaves state unchanged when the plugin is not in the list", () => {
      const state = initial();

      const next = reduce(
        state,
        actions.updatePluginWarnings("missing.esp", "missing-master", true),
      );

      expect(next).toBe(state);
    });

    test("does not throw after the plugin list has been cleared", () => {
      // profile-will-change dispatches setPluginList(undefined); a late warning update must not crash
      const cleared = reduce(initial(), actions.setPluginList(undefined));

      expect(() =>
        reduce(cleared, actions.updatePluginWarnings("some.esp", "missing-master", true)),
      ).not.toThrow();
    });
  });

  describe("new plugin counter", () => {
    test("incrementNewPluginCounter adds to the running total", () => {
      const once = reduce(initial(), actions.incrementNewPluginCounter(2));
      const twice = reduce(once, actions.incrementNewPluginCounter(3));

      expect(twice.newlyAddedPlugins).toBe(5);
    });

    test("clearNewPluginCounter resets the total to 0", () => {
      const state = { ...initial(), newlyAddedPlugins: 7 };

      const next = reduce(state, actions.clearNewPluginCounter());

      expect(next.newlyAddedPlugins).toBe(0);
    });
  });
});
