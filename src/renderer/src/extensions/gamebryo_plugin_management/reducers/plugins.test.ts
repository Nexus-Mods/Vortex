import { describe, expect, test } from "vitest";

import { makePlugin, makePluginCombined } from "../../../test-utils/builders";
import * as actions from "../actions/plugins";
import { type IPluginsSessionState, pluginsReducer } from "./plugins";

// invoke a single case of the reducer spec by the action it handles
function reduce(state: IPluginsSessionState, action: { type: string; payload: unknown }) {
  return pluginsReducer.reducers[action.type](state, action.payload);
}

const initial = () => ({ ...pluginsReducer.defaults });

describe("pluginsReducer", () => {
  describe("setPluginList", () => {
    test("stores the provided plugin map", () => {
      const plugins = { "a.esp": makePlugin({ filePath: "C:/a.esp" }) };

      const next = reduce(initial(), actions.setPluginList(plugins));

      expect(next.pluginList).toEqual(plugins);
    });

    test("replaces any existing plugin list", () => {
      const state = {
        ...initial(),
        pluginList: { "old.esp": makePlugin({ filePath: "C:/old.esp" }) },
      };
      const plugins = { "new.esp": makePlugin({ filePath: "C:/new.esp" }) };

      const next = reduce(state, actions.setPluginList(plugins));

      expect(next.pluginList).toEqual({ "new.esp": makePlugin({ filePath: "C:/new.esp" }) });
    });

    test("resets pluginList to {} when passed undefined rather than leaving it undefined", () => {
      const next = reduce(initial(), actions.setPluginList(undefined));

      expect(next.pluginList).toEqual({});
    });
  });

  describe("setPluginInfo", () => {
    test("stores the provided plugin info map", () => {
      const info = { "a.esp": makePluginCombined({ name: "a.esp", filePath: "C:/a.esp" }) };

      const next = reduce(initial(), actions.setPluginInfo(info));

      expect(next.pluginInfo).toEqual(info);
    });
  });

  describe("setPluginFilePath", () => {
    test("sets filePath on both pluginList and pluginInfo, preserving other fields", () => {
      const state = {
        ...initial(),
        pluginList: { "a.esp": makePlugin({ filePath: "C:/old/a.esp", modId: "mod-a" }) },
        pluginInfo: { "a.esp": makePluginCombined({ name: "a.esp", filePath: "C:/old/a.esp" }) },
      };

      const next = reduce(state, actions.setPluginFilePath("a.esp", "C:/a.esp"));

      expect(next.pluginList["a.esp"]).toEqual(
        makePlugin({ filePath: "C:/a.esp", modId: "mod-a" }),
      );
      expect(next.pluginInfo["a.esp"]).toEqual(
        makePluginCombined({ name: "a.esp", filePath: "C:/a.esp" }),
      );
    });

    test("creates the entry when the plugin is not yet present", () => {
      const next = reduce(initial(), actions.setPluginFilePath("a.esp", "C:/a.esp"));

      expect(next.pluginList["a.esp"]).toEqual({ filePath: "C:/a.esp" });
      expect(next.pluginInfo["a.esp"]).toEqual({ filePath: "C:/a.esp" });
    });
  });

  describe("updatePluginWarnings", () => {
    test("sets the warning flag on an existing plugin", () => {
      const state = { ...initial(), pluginList: { "a.esp": makePlugin({ filePath: "C:/a.esp" }) } };

      const next = reduce(state, actions.updatePluginWarnings("a.esp", "missing-master", true));

      expect(next.pluginList["a.esp"].warnings).toEqual({ "missing-master": true });
      expect(next.pluginList["a.esp"].filePath).toBe("C:/a.esp");
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
