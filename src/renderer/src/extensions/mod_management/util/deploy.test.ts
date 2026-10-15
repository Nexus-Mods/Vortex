import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { makeDeploymentMethod } from "../../../test-utils/builders";
import { makeHalfPurgedGame } from "../../../test-utils/deployedGame";
import { test } from "../../../test-utils/harnessTest";
import { purgeMods, purgeModsInPath } from "./deploy";
import { registerDeploymentMethod } from "./deploymentMethods";

// a method whose purge removes nothing
const leavingMethod = makeDeploymentMethod({
  id: "leaving-method",
  externalChanges: () => Promise.resolve([]),
});
registerDeploymentMethod(leavingMethod);

test("purging keeps the files the purge left in the manifest", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);

  await purgeMods(game.api, game.gameId);

  expect(await game.recordedFiles()).toEqual(["left-behind.esp"]);
});

test("purging one mod type's folder keeps the files the purge left in its manifest", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);

  await purgeModsInPath(game.api, game.gameId, "", game.dataPath);

  expect(await game.recordedFiles()).toEqual(["left-behind.esp"]);
});

test("purging one mod type's folder goes ahead over a damaged manifest", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);
  await writeFile(path.join(game.dataPath, "vortex.deployment.json"), '{"damaged');

  await purgeModsInPath(game.api, game.gameId, "", game.dataPath);

  expect(game.dialogCalls).toEqual([]);
});
