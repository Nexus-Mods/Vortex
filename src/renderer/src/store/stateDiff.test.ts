import { describe, it, expect } from "vitest";

import { computeStateDiff } from "./stateDiff";

describe("computeStateDiff", () => {
  it("generates set operation for a Date value", () => {
    const oldState = { mods: {} };
    const newState = {
      mods: {
        skyrim: {
          testMod: {
            installationPath: "testMod",
            attributes: {
              installTime: new Date("2026-03-17T16:11:55.000Z"),
            },
          },
        },
      },
    };

    const ops = computeStateDiff(oldState, newState);
    const installTimeOp = ops.find(
      (op) => op.path.join(".") === "mods.skyrim.testMod.attributes.installTime",
    );
    expect(installTimeOp).toBeDefined();
    expect(installTimeOp.type).toBe("set");
  });

  it("generates remove operation for a Date value", () => {
    const oldState = {
      mods: {
        skyrim: {
          testMod: {
            installationPath: "testMod",
            attributes: {
              installTime: new Date("2026-03-17T16:11:55.000Z"),
            },
          },
        },
      },
    };
    const newState = { mods: {} };

    const ops = computeStateDiff(oldState, newState);
    const installTimeOp = ops.find(
      (op) => op.path.join(".") === "mods.skyrim.testMod.attributes.installTime",
    );
    expect(installTimeOp).toBeDefined();
    expect(installTimeOp.type).toBe("remove");
  });

  it("does not leave orphaned Date entries after add then remove", () => {
    const emptyState = { mods: {} };
    const withMod = {
      mods: {
        skyrim: {
          testMod: {
            installationPath: "testMod",
            state: "installed",
            attributes: {
              name: "testMod",
              installTime: new Date("2026-03-17T16:11:55.000Z"),
            },
          },
        },
      },
    };

    // Adding the mod should produce set ops for every leaf including installTime
    const addOps = computeStateDiff(emptyState, withMod);
    const addPaths = new Set(addOps.map((op) => op.path.join(".")));
    expect(addPaths.has("mods.skyrim.testMod.installationPath")).toBe(true);
    expect(addPaths.has("mods.skyrim.testMod.attributes.installTime")).toBe(true);

    // Removing the mod should produce remove ops for every leaf including installTime
    const removeOps = computeStateDiff(withMod, emptyState);
    const removePaths = new Set(removeOps.map((op) => op.path.join(".")));
    expect(removePaths.has("mods.skyrim.testMod.installationPath")).toBe(true);
    expect(removePaths.has("mods.skyrim.testMod.attributes.installTime")).toBe(true);

    // Every path that was set must also be removed — no orphans
    for (const p of addPaths) {
      expect(removePaths.has(p)).toBe(true);
    }
  });

  it("generates set and remove operations for an invalid Date", () => {
    const invalidDate = new Date("not-a-date");
    expect(invalidDate.toString()).toBe("Invalid Date");

    const oldState = { mods: {} };
    const withInvalidDate = {
      mods: {
        skyrim: {
          testMod: {
            installationPath: "testMod",
            attributes: {
              installTime: invalidDate,
            },
          },
        },
      },
    };

    const addOps = computeStateDiff(oldState, withInvalidDate);
    const setOp = addOps.find(
      (op) => op.path.join(".") === "mods.skyrim.testMod.attributes.installTime",
    );
    expect(setOp).toBeDefined();
    expect(setOp.type).toBe("set");

    const removeOps = computeStateDiff(withInvalidDate, oldState);
    const removeOp = removeOps.find(
      (op) => op.path.join(".") === "mods.skyrim.testMod.attributes.installTime",
    );
    expect(removeOp).toBeDefined();
    expect(removeOp.type).toBe("remove");
  });

  it("emits a remove at the container path when an object subtree is removed", () => {
    // The persistence layer treats remove ops as subtree removals (key + any
    // descendants). For that to clear a JSON blob stored at an intermediate
    // path - which is what happens to non-plain objects in
    // collectSetOperations - the diff must include a remove at that path,
    // not just at deeper leaves.
    const oldState = {
      files: {
        downloadId: {
          failCause: new Error("network failed"),
        },
      },
    };
    const newState = { files: {} };

    const ops = computeStateDiff(oldState, newState);
    const removePaths = new Set(
      ops.filter((op) => op.type === "remove").map((op) => op.path.join(".")),
    );

    // The container itself must be removed - this is what sweeps a blob
    // stored at `files###downloadId` in the kv table.
    expect(removePaths.has("files.downloadId")).toBe(true);
    // And the non-plain-object child too, in case it was decomposed.
    expect(removePaths.has("files.downloadId.failCause")).toBe(true);
  });

  it("generates set operation when Date replaces a string", () => {
    // Simulates startInstallCB (string) -> finishInstallCB (Date)
    const oldState = {
      attributes: { installTime: "Tue Mar 17 2026 16:11:55 GMT+0000" },
    };
    const newState = {
      attributes: { installTime: new Date("2026-03-17T16:11:55.000Z") },
    };

    // intentionally mismatched types to simulate real-world usage (string -> Date)
    const ops = computeStateDiff(oldState, newState as unknown as typeof oldState);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("set");
    expect(ops[0].path).toEqual(["attributes", "installTime"]);
  });
});
