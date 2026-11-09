import * as core from "@actions/core";

import { applyPlan, PACKAGE_JSON, WORKSPACE_YAML } from "./apply";
import { realIo } from "./io";
import { planUpgrade } from "./plan";
import { fetchNodeAbiPackument, fetchReleases } from "./remote";
import { readPins } from "./workspace";

/** Action entry point. Plans the upgrade and, unless `check` is set, applies it. */
const run = async (): Promise<void> => {
  const check = core.getBooleanInput("check");
  const root = process.cwd();
  const io = realIo(root);

  // Planning asks the installed node-abi about the target Electron, so dependencies must be
  // installed first. Frozen, so a stale lockfile fails here, before anything is changed.
  await io.install({ frozen: true });

  const pins = readPins(io.readText(WORKSPACE_YAML), io.readText(PACKAGE_JSON));
  core.info(`Current: electron ${pins.electron}, node ${pins.node}, node-abi ${pins.nodeAbi}`);

  const plan = await planUpgrade(pins, {
    fetchReleases: () => fetchReleases(),
    fetchNodeAbiPackument: () => fetchNodeAbiPackument(),
    abiKnown: (version) => io.abiKnown(version),
    now: () => Date.now(),
  });
  if (plan === undefined) {
    core.info("Up to date");
    core.setOutput("updated", "false");
    return;
  }

  core.info(
    `Upgrading: electron ${plan.electron.from} -> ${plan.electron.to}, ` +
      `node ${plan.node.from} -> ${plan.node.to}` +
      (plan.nodeAbi === undefined ? "" : `, node-abi ${plan.nodeAbi.from} -> ${plan.nodeAbi.to}`),
  );
  if (check) {
    core.setOutput("updated", "false");
    return;
  }

  await applyPlan(plan, io);

  core.setOutput("updated", "true");
  core.setOutput("electron-old", plan.electron.from);
  core.setOutput("electron-new", plan.electron.to);
  core.setOutput("node-old", plan.node.from);
  core.setOutput("node-new", plan.node.to);
  core.setOutput("node-abi-old", plan.nodeAbi?.from ?? pins.nodeAbi);
  core.setOutput("node-abi-new", plan.nodeAbi?.to ?? pins.nodeAbi);
};

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
