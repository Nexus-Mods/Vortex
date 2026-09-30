import { expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";

/** Sits either side of the files whose unlink fails. */
const FILES = {
  "CrashLogger.ini": "[Debug]",
  "BugFixesSSE.log": "log line",
  "po3_Tweaks.ini": "[General]",
  "ActorLimitFix.log": "log line",
  "SkyUI_SE.esp": "esp data",
};

const BLOCKED = ["BugFixesSSE.log", "ActorLimitFix.log"];

test("a re-deploy that cannot unlink some files leaves the rest deployed", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({ files: FILES });
  await h.deploy();
  expect(h.deployedFiles().sort()).toEqual(Object.keys(FILES).sort());

  for (const relPath of BLOCKED) {
    h.blockUnlink(relPath);
  }

  // the manifest predates the staged files, so the re-deploy treats them as content-changed
  await h.deploy(h.manifest(1));

  const expected = Object.keys(FILES)
    .filter((rel) => !BLOCKED.includes(rel))
    .sort();
  expect(h.deployedFiles().sort()).toEqual(expected);
});
