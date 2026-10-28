import { describe, expect, it } from "vitest";

import { type PlanDeps, planUpgrade } from "./plan";
import { type ElectronRelease, type NpmPackument } from "./schemas";
import { DAY, MINUTE, NOW, release } from "./test-fixtures";
import { type Pins } from "./workspace";

const pins: Pins = {
  electron: "45.0.0",
  node: "24.22.0",
  nodeAbi: "4.35.0",
  minReleaseAgeMs: 1440 * MINUTE,
};

const packument: NpmPackument = {
  versions: { "4.35.0": {}, "4.36.0": {} },
  time: {
    "4.35.0": new Date(NOW - 90 * DAY).toISOString(),
    "4.36.0": new Date(NOW - 3 * DAY).toISOString(),
  },
};

const deps = (releases: ElectronRelease[], overrides: Partial<PlanDeps> = {}): PlanDeps => ({
  fetchReleases: () => Promise.resolve(releases),
  fetchNodeAbiPackument: () => Promise.resolve(packument),
  abiKnown: () => Promise.resolve(true),
  now: () => NOW,
  ...overrides,
});

describe("planUpgrade", () => {
  it("returns undefined when everything is current", async () => {
    const releases = [release("45.0.0", "24.22.0", 10 * DAY)];
    await expect(planUpgrade(pins, deps(releases))).resolves.toBeUndefined();
  });

  it("ignores a newer release that is too young", async () => {
    const releases = [
      release("45.0.0", "24.22.0", 10 * DAY),
      release("45.1.0", "24.22.1", 60 * MINUTE),
    ];
    await expect(planUpgrade(pins, deps(releases))).resolves.toBeUndefined();
  });

  it("upgrades Electron and Node together", async () => {
    const releases = [
      release("45.0.0", "24.22.0", 10 * DAY),
      release("45.1.0", "24.22.1", 2 * DAY),
    ];
    await expect(planUpgrade(pins, deps(releases))).resolves.toEqual({
      electron: { from: "45.0.0", to: "45.1.0" },
      node: { from: "24.22.0", to: "24.22.1" },
      nodeAbi: undefined,
    });
  });

  it("syncs Node when Electron is current but the Node pin drifted", async () => {
    const releases = [release("45.0.0", "24.22.1", 10 * DAY)];
    await expect(planUpgrade(pins, deps(releases))).resolves.toEqual({
      electron: { from: "45.0.0", to: "45.0.0" },
      node: { from: "24.22.0", to: "24.22.1" },
      nodeAbi: undefined,
    });
  });

  it("fails when the current Electron is not listed", async () => {
    await expect(planUpgrade(pins, deps([]))).rejects.toThrow("45.0.0 is not listed");
  });

  it("bumps node-abi when it does not know the target", async () => {
    const releases = [release("45.1.0", "24.22.1", 2 * DAY)];
    const plan = await planUpgrade(
      pins,
      deps(releases, { abiKnown: () => Promise.resolve(false) }),
    );
    expect(plan?.nodeAbi).toEqual({ from: "4.35.0", to: "4.36.0" });
  });

  it("asks node-abi about the target, not the current version", async () => {
    const asked: string[] = [];
    const releases = [release("45.1.0", "24.22.1", 2 * DAY)];
    await planUpgrade(
      pins,
      deps(releases, {
        abiKnown: (version) => {
          asked.push(version);
          return Promise.resolve(true);
        },
      }),
    );
    expect(asked).toEqual(["45.1.0"]);
  });

  it("fails when node-abi does not know the target and has no newer version", async () => {
    const releases = [release("45.1.0", "24.22.1", 2 * DAY)];
    const stale: NpmPackument = { versions: { "4.35.0": {} }, time: packument.time };
    await expect(
      planUpgrade(
        pins,
        deps(releases, {
          abiKnown: () => Promise.resolve(false),
          fetchNodeAbiPackument: () => Promise.resolve(stale),
        }),
      ),
    ).rejects.toThrow("no newer node-abi is available");
  });

  it("does not fetch node-abi when it already knows the target", async () => {
    const releases = [release("45.1.0", "24.22.1", 2 * DAY)];
    await expect(
      planUpgrade(
        pins,
        deps(releases, {
          fetchNodeAbiPackument: () => Promise.reject(new Error("should not be called")),
        }),
      ),
    ).resolves.toMatchObject({ nodeAbi: undefined });
  });
});
