import { writeFile } from "node:fs/promises";
import * as path from "node:path";

import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { clearPurgeProgress, setPurgeProgress, stopActivity } from "../../../actions/session";
import { makeDeploymentMethod } from "../../../test-utils/builders";
import { makeHalfPurgedGame } from "../../../test-utils/deployedGame";
import { test } from "../../../test-utils/harnessTest";
import type { IPurgeProgress } from "../../../types/IState";
import { ProcessCanceled } from "../../../util/CustomErrors";
import { deploymentReducer } from "../reducers/deployment";
import { withActivationLock } from "./activationStore";
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

// a method that, mid-purge, queues work behind it on the activation lock, as a deploy would
let queuedBehindPurge: PromiseLike<unknown>;
let dispatchedSoFar: () => Array<{ type: string; payload?: unknown }>;
let seenByNextInLine: Array<{ type: string; payload?: unknown }>;
const queuingMethod = makeDeploymentMethod({
  id: "queuing-method",
  externalChanges: () => Promise.resolve([]),
  prePurge: () => {
    queuedBehindPurge = withActivationLock(async () => {
      seenByNextInLine = [...dispatchedSoFar()];
    }, false);
    return Promise.resolve();
  },
});
registerDeploymentMethod(queuingMethod);

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

/** The purge progress the store was given, in order: a record per update, null when cleared. */
const purgeUpdates = (dispatched: Array<{ type: string; payload?: unknown }>) =>
  dispatched
    .filter(
      (action) =>
        action.type === setPurgeProgress.getType() || action.type === clearPurgeProgress.getType(),
    )
    .map((action) =>
      action.type === setPurgeProgress.getType()
        ? (action.payload as { purgeId: string } & IPurgeProgress)
        : null,
    );

test("purging reports how far along it is in the store, for the game it purges", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);

  await purgeMods(game.api, game.gameId);

  const updates = purgeUpdates(game.dispatched);
  expect(updates.filter(Boolean).map((update) => update.percent)).toContain(25);
  expect(updates.filter(Boolean).every((update) => update.gameId === game.gameId)).toBe(true);
  // cleared at the end, so the Apply button goes back to normal
  expect(updates.at(-1)).toBeNull();
});

test("a purge skipped because the activation lock is busy leaves nothing in the store", async () => {
  const game = await makeHalfPurgedGame(leavingMethod.id);
  let releaseLock: () => void;
  const holdingLock = withActivationLock(
    () => new Promise<void>((resolve) => (releaseLock = resolve)),
    false,
  );

  try {
    await purgeMods(game.api, game.gameId);
  } finally {
    releaseLock();
    await holdingLock;
  }

  expect(purgeUpdates(game.dispatched).at(-1)).toBeNull();
});

test("purging is out of the store before a deploy queued behind it starts", async () => {
  const game = await makeHalfPurgedGame(queuingMethod.id);
  dispatchedSoFar = () => game.dispatched;

  await purgeMods(game.api, game.gameId);
  await queuedBehindPurge;

  expect(purgeUpdates(seenByNextInLine).at(-1)).toBeNull();
  expect(seenByNextInLine.map((action) => action.type)).toContain(stopActivity.getType());
});

test("purging in the modern layout leaves the notification to the layout", async () => {
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
