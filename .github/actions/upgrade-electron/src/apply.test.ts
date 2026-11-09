import { describe, expect, it } from "vitest";

import { type ApplyIo, applyPlan, LOCKFILE, PACKAGE_JSON, WORKSPACE_YAML } from "./apply";
import { type Plan } from "./plan";
import { packageJson, workspaceYaml } from "./test-fixtures";

interface FakeIo extends ApplyIo {
  files: Map<string, string>;
  /** Ordered log of installs and abi checks. */
  calls: string[];
}

const fakeIo = (
  options: { changed?: string[]; abiAfterBump?: boolean; installFails?: boolean } = {},
): FakeIo => {
  const files = new Map([
    [PACKAGE_JSON, packageJson()],
    [WORKSPACE_YAML, workspaceYaml()],
  ]);
  const calls: string[] = [];
  return {
    files,
    calls,
    readText: (file) => {
      const text = files.get(file);
      if (text === undefined) {
        throw new Error(`no such file ${file}`);
      }
      return text;
    },
    writeText: (file, text) => {
      files.set(file, text);
    },
    install: ({ frozen }) => {
      calls.push(frozen ? "install --frozen-lockfile" : "install");
      return options.installFails === true && !frozen
        ? Promise.reject(new Error("install failed"))
        : Promise.resolve();
    },
    changedFiles: () =>
      Promise.resolve(options.changed ?? [PACKAGE_JSON, WORKSPACE_YAML, LOCKFILE]),
    abiKnown: (version) => {
      calls.push(`abi ${version}`);
      return Promise.resolve(options.abiAfterBump ?? true);
    },
  };
};

const plan: Plan = {
  electron: { from: "45.0.0", to: "45.1.0" },
  node: { from: "24.22.0", to: "24.22.1" },
  nodeAbi: undefined,
};

describe("applyPlan", () => {
  it("installs after each edit", async () => {
    const io = fakeIo();
    await applyPlan(plan, io);
    expect(io.calls).toEqual(["install", "install"]);
  });

  it("updates electron, the node pins and allowBuilds", async () => {
    const io = fakeIo();
    await applyPlan(plan, io);
    expect(io.files.get(WORKSPACE_YAML)).toBe(
      workspaceYaml({ electron: "45.1.0", node: "24.22.1" }),
    );
    expect(io.files.get(PACKAGE_JSON)).toBe(packageJson("24.22.1"));
  });

  it("leaves node alone when only Electron changes", async () => {
    const io = fakeIo();
    await applyPlan({ ...plan, node: { from: "24.22.0", to: "24.22.0" } }, io);
    expect(io.calls).toEqual(["install"]);
    expect(io.files.get(PACKAGE_JSON)).toBe(packageJson());
    expect(io.files.get(WORKSPACE_YAML)).toBe(workspaceYaml({ electron: "45.1.0" }));
  });

  it("bumps node-abi and re-checks it before touching Electron", async () => {
    const io = fakeIo();
    await applyPlan({ ...plan, nodeAbi: { from: "4.35.0", to: "4.36.0" } }, io);
    expect(io.calls).toEqual(["install", "abi 45.1.0", "install", "install"]);
    expect(io.files.get(WORKSPACE_YAML)).toBe(
      workspaceYaml({ electron: "45.1.0", nodeAbi: "4.36.0", node: "24.22.1" }),
    );
  });

  it("fails when node-abi still does not know Electron after the bump", async () => {
    const io = fakeIo({ abiAfterBump: false });
    await expect(
      applyPlan({ ...plan, nodeAbi: { from: "4.35.0", to: "4.36.0" } }, io),
    ).rejects.toThrow("node-abi 4.36.0 does not know Electron 45.1.0");
    expect(io.files.get(PACKAGE_JSON)).toBe(packageJson());
  });

  it("fails when anything besides the three files changed", async () => {
    const io = fakeIo({ changed: [PACKAGE_JSON, "src/main/package.json", "README.md"] });
    await expect(applyPlan(plan, io)).rejects.toThrow(
      "Unexpected changes in the working tree: src/main/package.json, README.md",
    );
  });

  it("propagates install failures", async () => {
    await expect(applyPlan(plan, fakeIo({ installFails: true }))).rejects.toThrow("install failed");
  });
});
