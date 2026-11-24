import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { setProgress } from "../../../actions/session";
import { makeDeploymentMethod } from "../../../test-utils/builders";
import { makeHalfPurgedGame } from "../../../test-utils/deployedGame";
import { test } from "../../../test-utils/harnessTest";
import { ProcessCanceled } from "../../../util/CustomErrors";
import { deploymentReducer } from "../reducers/deployment";
import { purgeMods, purgeModsInPath } from "./deploy";
import { registerDeploymentMethod } from "./deploymentMethods";

// a method whose purge removes nothing
const leavingMethod = makeDeploymentMethod({
  id: "leaving-method",
  externalChanges: () => Promise.resolve([]),
});
registerDeploymentMethod(leavingMethod);

// a method whose purge is cancelled before it removes anything
const cancelingMethod = makeDeploymentMethod({
  id: "canceling-method",
  externalChanges: () => Promise.resolve([]),
  prePurge: () => Promise.reject(new ProcessCanceled("canceled")),
});
registerDeploymentMethod(cancelingMethod);

const withDeploymentState = {
  extraReducers: [{ path: ["persistent", "deployment"], reducer: deploymentReducer }],
};

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

test("purging marks the game as purged", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id, withDeploymentState);

  await purgeMods(game.api, game.gameId);

  expect(game.api.getState().persistent.deployment.purged[game.gameId]).toBe(true);
});

test("a cancelled purge doesn't mark the game as purged", async () => {
  const game = await makeHalfPurgedGame(cancelingMethod.id, withDeploymentState);

  await purgeMods(game.api, game.gameId);

  expect(game.api.getState().persistent.deployment.purged[game.gameId]).toBeFalsy();
});

test("purging reports how far along it is in the store, for the menu's Apply button", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);

  await purgeMods(game.api, game.gameId);

  const purgeProgress = game.dispatched
    .filter((action) => action.type === setProgress.getType())
    .map((action) => action.payload as { group: string; progressId: string; percent: number })
    .filter((payload) => payload.group === "mods" && payload.progressId === "purging");
  expect(purgeProgress.map((payload) => payload.percent)).toContain(25);
  // cleared at the end, so a later purge starts from an empty bar
  expect(purgeProgress.at(-1)).toMatchObject({ text: undefined, percent: 0 });
});

test("purging leaves the notification out, as the menu's Apply button shows its progress", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);

  await purgeMods(game.api, game.gameId);

  expect(game.notifications.filter((notification) => notification.title === "Purging")).toEqual([]);
});

test("purging in the legacy layout, which has no Apply button, still notifies", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);
  game.setState((draft) => {
    draft.settings.window = { ...draft.settings.window, useModernLayout: false };
  });

  await purgeMods(game.api, game.gameId);

  expect(game.notifications.some((notification) => notification.title === "Purging")).toBe(true);
});
