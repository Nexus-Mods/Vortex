import { describe, it, expect } from "vitest";

import { flattenState } from "./flattenState";

describe("flattenState", () => {
  it("returns a single leaf for primitives", () => {
    expect(flattenState(42, ["a"])).toEqual([{ key: ["a"], value: 42 }]);
    expect(flattenState("x", ["a"])).toEqual([{ key: ["a"], value: "x" }]);
    expect(flattenState(true, [])).toEqual([{ key: [], value: true }]);
  });

  it("treats null/undefined and arrays as whole leaf values", () => {
    expect(flattenState(null, ["a"])).toEqual([{ key: ["a"], value: null }]);
    expect(flattenState(undefined, ["a"])).toEqual([{ key: ["a"], value: undefined }]);
    // arrays are stored whole, not recursed into
    expect(flattenState({ rules: [1, 2, 3] })).toEqual([{ key: ["rules"], value: [1, 2, 3] }]);
  });

  it("flattens nested objects to one leaf per path", () => {
    const leaves = flattenState({
      mods: { skyrimse: { mod1: { installationPath: "p", attributes: { name: "n" } } } },
    });
    expect(leaves).toContainEqual({
      key: ["mods", "skyrimse", "mod1", "installationPath"],
      value: "p",
    });
    expect(leaves).toContainEqual({
      key: ["mods", "skyrimse", "mod1", "attributes", "name"],
      value: "n",
    });
    expect(leaves).toHaveLength(2);
  });

  it("does not overflow on a very wide state (GH#23355 regression)", () => {
    // The previous implementation used `result.push(...flattenState(...))`;
    // spreading a large array into push throws "Maximum call stack size
    // exceeded" at ~250k elements. 300k stays safely past that threshold.
    const wide: Record<string, number> = {};
    for (let i = 0; i < 300000; i++) {
      wide["k" + i] = i;
    }
    const leaves = flattenState({ persistent: { downloads: wide } });
    expect(leaves).toHaveLength(300000);
    expect(leaves[0]!.key.slice(0, 2)).toEqual(["persistent", "downloads"]);
  });
});
