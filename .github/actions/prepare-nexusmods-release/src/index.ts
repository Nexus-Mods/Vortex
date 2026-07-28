/**
 * Action entry point for the Publish Release to Nexus Mods workflow.
 *
 * Reads the action inputs, delegates to {@link preparePublish}, and publishes
 * the result as action outputs the workflow wires into the upload step.
 */

import * as child_process from "node:child_process";

import * as core from "@actions/core";

import { preparePublish, type PublishPlan } from "./prepare";

/** Logs what was prepared, including the full changelog. */
const summarise = (plan: PublishPlan): void => {
  core.info(`Tag:       ${plan.tagName}`);
  core.info(`Version:   ${plan.version}`);
  core.info(`Installer: ${plan.installerName}`);
  core.startGroup("Changelog");
  core.info(plan.changelog);
  core.endGroup();
};

const run = async (): Promise<void> => {
  const dryRun = core.getBooleanInput("dry-run");
  const token = core.getInput("github-token");

  const plan = await preparePublish({
    dryRun,
    tag: core.getInput("tag", { required: true }),
    changelogPath: core.getInput("changelog-path", { required: true }),
    downloadDir: core.getInput("download-dir", { required: true }),
    // Wrap the real `gh` CLI so preparePublish can be swapped with a fake in
    // tests via the ghRun option. execFileSync avoids a shell, so tags and
    // asset names are never word-split or expanded.
    ghRun: (args) =>
      child_process.execFileSync("gh", args, {
        encoding: "utf8",
        env: { ...process.env, GH_TOKEN: token },
      }),
  });

  core.setOutput("tag", plan.tagName);
  core.setOutput("version", plan.version);
  core.setOutput("installer-name", plan.installerName);
  core.setOutput("installer-path", plan.installerPath);
  core.setOutput("body", plan.body);
  core.setOutput("changelog", plan.changelog);

  if (dryRun) {
    core.info("DRY RUN - the installer was not downloaded and nothing will be uploaded.");
  }
  summarise(plan);
};

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
