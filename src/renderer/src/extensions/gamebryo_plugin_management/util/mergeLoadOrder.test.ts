import { describe, expect, test } from "vitest";

import { makePluginCombined } from "../../../test-utils/builders";
import { mergeLoadOrder } from "./mergeLoadOrder";

describe("mergeLoadOrder", () => {
  test("keeps the plugin's file name whatever name the load order entry carries", () => {
    const plugin = makePluginCombined({ name: "MixedCase.esp" });

    const [merged] = mergeLoadOrder([plugin], {
      "mixedcase.esp": { name: "mixedcase.esp", enabled: true, loadOrder: 3 },
    });

    expect(merged).toMatchObject({ name: "MixedCase.esp", enabled: true, loadOrder: 3 });
  });

  test("disables and unpositions a plugin missing from the load order", () => {
    const plugin = makePluginCombined({ name: "Gone.esp", enabled: true, loadOrder: 4 });

    const [merged] = mergeLoadOrder([plugin], {});

    expect(merged).toMatchObject({ enabled: false, loadOrder: undefined });
  });

  test("leaves the given plugins untouched", () => {
    const plugin = makePluginCombined({ name: "A.esp", enabled: false, loadOrder: 0 });

    mergeLoadOrder([plugin], { "a.esp": { name: "A.esp", enabled: true, loadOrder: 7 } });

    expect(plugin).toMatchObject({ enabled: false, loadOrder: 0 });
  });

  test("keeps the plugin object when its flag and position already match", () => {
    const plugin = makePluginCombined({ name: "A.esp", enabled: true, loadOrder: 2 });

    const [merged] = mergeLoadOrder([plugin], {
      "a.esp": { name: "A.esp", enabled: true, loadOrder: 2 },
    });

    expect(merged).toBe(plugin);
  });
});
