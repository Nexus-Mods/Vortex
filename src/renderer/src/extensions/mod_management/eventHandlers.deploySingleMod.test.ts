import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { makeApplyDeployedGame } from "../../test-utils/deployedGame";
import { test } from "../../test-utils/harnessTest";
import { type DeployProfile, onDeploySingleMod } from "./eventHandlers";

/** A game deploying through Apply with one mod, "First", deployed, recording the events emitted. */
async function makeApplyGameWithDeployedMod() {
  const game = await makeApplyDeployedGame(["First"]);
  const emitted = vi.spyOn(game.api, "emitAndAwait");
  /** The events emitted so far, by name. */
  const emittedEvents = () => emitted.mock.calls.map(([event]) => event);
  /** Deploys the mod as the "deploy-single-mod" event handler does. */
  const deploySingleMod = (deployProfile: DeployProfile, enable?: boolean) =>
    onDeploySingleMod(game.api, deployProfile)(game.gameId, "First", enable);
  return { game, emittedEvents, deploySingleMod };
}

test("a single-mod deployment through Apply deploys the game's last active profile", async () => {
  const { game, emittedEvents, deploySingleMod } = await makeApplyGameWithDeployedMod();
  let emittedBeforeDeploy: string[] = [];
  const deployProfile = vi.fn<DeployProfile>(() => {
    emittedBeforeDeploy = emittedEvents();
    return Promise.resolve();
  });

  await deploySingleMod(deployProfile, false);

  expect(deployProfile).toHaveBeenCalledWith(game.profileId);
  expect(emittedBeforeDeploy).toEqual(["will-deploy-single-mod"]);
  expect(emittedEvents()).toEqual(["will-deploy-single-mod", "did-deploy-single-mod"]);
  // the recorded deployment leaves the game folder as it was
  expect(await game.recordedFiles()).toEqual(["First.esp"]);
});

test("a single-mod deployment through Apply whose deployment fails reports no finished deployment", async () => {
  const { emittedEvents, deploySingleMod } = await makeApplyGameWithDeployedMod();

  await deploySingleMod(() => Promise.reject(new Error("deployment failed")));

  expect(emittedEvents()).toEqual(["will-deploy-single-mod"]);
});
