import { describe, expect, it } from "vitest";

import { packageJson, workspaceYaml } from "./test-fixtures";
import {
  readPins,
  setAllowBuildsNode,
  setElectron,
  setNodeAbi,
  setPackageJsonNode,
} from "./workspace";

describe("readPins", () => {
  it("reads the pinned versions", () => {
    expect(readPins(workspaceYaml(), packageJson())).toEqual({
      electron: "45.0.0",
      node: "24.22.0",
      nodeAbi: "4.35.0",
      minReleaseAgeMs: 1440 * 60 * 1000,
    });
  });

  it("does not mistake electron-builder for electron", () => {
    const text = workspaceYaml().replace("  electron: 45.0.0\n", "");
    expect(() => readPins(text, packageJson())).toThrow("electron catalog entry");
  });

  it("fails when the package.json node pins disagree", () => {
    const text = packageJson().replace('"node": "24.22.0"', '"node": "24.22.1"');
    expect(() => readPins(workspaceYaml(), text)).toThrow("engines.node is 24.22.1");
  });

  it("fails when package.json lacks the pins", () => {
    expect(() => readPins(workspaceYaml(), "{}")).toThrow(/engines/u);
  });

  it("fails without minimumReleaseAge", () => {
    const text = workspaceYaml().replace("minimumReleaseAge: 1440\n", "");
    expect(() => readPins(text, packageJson())).toThrow("minimumReleaseAge");
  });
});

describe("setElectron", () => {
  it("rewrites only the electron entry", () => {
    expect(setElectron(workspaceYaml(), "45.0.0", "45.1.0")).toBe(
      workspaceYaml({ electron: "45.1.0" }),
    );
  });

  it("fails when the current version is not pinned", () => {
    expect(() => setElectron(workspaceYaml(), "44.0.0", "45.1.0")).toThrow("found 0");
  });
});

describe("setNodeAbi", () => {
  it("rewrites the catalog and overrides entries", () => {
    expect(setNodeAbi(workspaceYaml(), "4.35.0", "4.36.0")).toBe(
      workspaceYaml({ nodeAbi: "4.36.0" }),
    );
  });

  it("fails when catalog and overrides have drifted apart", () => {
    const text = workspaceYaml().replace(
      "overrides:\n  node-abi: 4.35.0",
      "overrides:\n  node-abi: 4.34.0",
    );
    expect(() => setNodeAbi(text, "4.35.0", "4.36.0")).toThrow("found 1");
  });
});

describe("setPackageJsonNode", () => {
  it("rewrites all three pins", () => {
    expect(setPackageJsonNode(packageJson(), "24.22.0", "24.22.1")).toBe(packageJson("24.22.1"));
  });

  it("fails when the pin count is off", () => {
    expect(() => setPackageJsonNode('{"node": "24.22.0"}', "24.22.0", "24.22.1")).toThrow(
      "found 1",
    );
  });
});

describe("setAllowBuildsNode", () => {
  it("replaces the old entry in place", () => {
    expect(setAllowBuildsNode(workspaceYaml(), "24.22.0", "24.22.1")).toBe(
      workspaceYaml({ node: "24.22.1" }),
    );
  });

  it("adds the entry in alphabetical position when the old one is missing", () => {
    const without = workspaceYaml().replace("  node@runtime:24.22.0: true\n", "");
    expect(setAllowBuildsNode(without, "24.22.0", "24.22.1")).toBe(
      workspaceYaml({ node: "24.22.1" }),
    );
  });

  it("appends when it sorts last", () => {
    const text = "allowBuilds:\n  a: true\n";
    expect(setAllowBuildsNode(text, "1.0.0", "1.0.1")).toBe(
      "allowBuilds:\n  a: true\n  node@runtime:1.0.1: true\n",
    );
  });

  it("leaves comments and the rest of the file alone", () => {
    const text = "allowBuilds:\n  # keep\n  a: true\n  nx: false\n\nother: 1\n";
    expect(setAllowBuildsNode(text, "1.0.0", "1.0.1")).toBe(
      "allowBuilds:\n  # keep\n  a: true\n  node@runtime:1.0.1: true\n  nx: false\n\nother: 1\n",
    );
  });

  it("fails without an allowBuilds block", () => {
    expect(() => setAllowBuildsNode("catalog:\n  a: 1\n", "1.0.0", "1.0.1")).toThrow("allowBuilds");
  });
});
