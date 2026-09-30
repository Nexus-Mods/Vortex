import * as path from "node:path";

import { expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";
import type { ITrackedAction } from "../../test-utils/harnessTypes";
import type { IDeploymentFailure } from "../mod_management/actions/session";
import { addDeploymentFailures } from "../mod_management/actions/session";

const FILES = {
  "CrashLogger.ini": "[Debug]",
  "BugFixesSSE.log": "log line",
  "SkyUI_SE.esp": "esp data",
};

function recordedFailures(dispatched: ITrackedAction[]): IDeploymentFailure[] {
  return dispatched
    .filter((action) => action.type === String(addDeploymentFailures))
    .flatMap((action) => (action.payload as { failures: IDeploymentFailure[] }).failures);
}

test("a deploy records every file it could not place, and the mod it came from", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({ files: FILES });
  await h.deploy();
  h.blockUnlink("BugFixesSSE.log");

  await h.deploy(h.manifest(1));

  expect(recordedFailures(h.dispatched)).toEqual([
    {
      source: "SomeMod",
      relPath: "BugFixesSSE.log",
      outputPath: path.join(h.gameDir, "BugFixesSSE.log"),
    },
  ]);
});

test("a deploy that placed every file records no failures", async ({ makeDeployment }) => {
  const h = makeDeployment({ files: FILES });
  await h.deploy();

  await h.deploy(h.manifest(1));

  expect(recordedFailures(h.dispatched)).toEqual([]);
});
