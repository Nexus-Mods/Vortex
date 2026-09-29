import { describe, expect, it } from "vitest";

import { assignPriorities } from "./modSettingsPriority";

const priorities = (result: ReturnType<typeof assignPriorities>) =>
  result.map((entry) => entry.priority);

const names = (result: ReturnType<typeof assignPriorities>) => result.map((entry) => entry.name);

describe("assignPriorities", () => {
  it("gives every mod a distinct priority when none are in the load order", () => {
    // A purge removes mods.settings, so the next deploy sees an empty load
    // order and has to place every mod at once.
    const result = assignPriorities({
      mods: ["modA", "modB", "modC", "modD"],
      locked: [],
      loadOrderIds: [],
    });

    expect(priorities(result)).toEqual([1, 2, 3, 4]);
    expect(new Set(priorities(result)).size).toBe(result.length);
  });

  it("keeps the order the user arranged", () => {
    const result = assignPriorities({
      mods: ["modA", "modB", "modC"],
      locked: [],
      loadOrderIds: ["modC", "modA", "modB"],
    });

    expect(names(result)).toEqual(["modC", "modA", "modB"]);
    expect(priorities(result)).toEqual([1, 2, 3]);
  });

  it("pins locked mods to the top in their own order", () => {
    const result = assignPriorities({
      mods: ["modA", "mod0000_MergedFiles", "modB"],
      locked: ["mod0000_MergedFiles"],
      loadOrderIds: ["modB", "modA"],
    });

    expect(names(result)).toEqual(["mod0000_MergedFiles", "modB", "modA"]);
    expect(priorities(result)).toEqual([1, 2, 3]);
  });

  it("appends mods the load order does not know about, without colliding", () => {
    const result = assignPriorities({
      mods: ["modA", "modNew1", "modB", "modNew2"],
      locked: [],
      loadOrderIds: ["modA", "modB"],
    });

    expect(names(result)).toEqual(["modA", "modB", "modNew1", "modNew2"]);
    expect(new Set(priorities(result)).size).toBe(4);
  });

  it("never collides a load order entry with the locked range", () => {
    const result = assignPriorities({
      mods: ["lockedOne", "lockedTwo", "modA", "modB"],
      locked: ["lockedOne", "lockedTwo"],
      loadOrderIds: ["modA", "modB"],
    });

    expect(priorities(result)).toEqual([1, 2, 3, 4]);
  });

  it("drops dlc folders, which are mounted from the DLC directory", () => {
    const result = assignPriorities({
      mods: ["modA", "dlcSomething", "modB"],
      locked: [],
      loadOrderIds: [],
    });

    expect(names(result)).toEqual(["modA", "modB"]);
  });

  it("carries the mod id through as the key", () => {
    const result = assignPriorities({
      mods: [{ name: "modA", id: "modA-1.0" }, "modManual"],
      locked: [],
      loadOrderIds: [],
    });

    expect(result).toEqual([
      { name: "modA", key: "modA-1.0", priority: 1 },
      { name: "modManual", key: "modManual", priority: 2 },
    ]);
  });

  it("keeps one entry per folder name", () => {
    // The gathered list concatenates merged, managed and manual mods, which can
    // name the same folder more than once.
    const result = assignPriorities({
      mods: ["modA", { name: "modA", id: "modA-1.0" }, "modB"],
      locked: [],
      loadOrderIds: [],
    });

    expect(names(result)).toEqual(["modA", "modB"]);
    expect(priorities(result)).toEqual([1, 2]);
  });
});
