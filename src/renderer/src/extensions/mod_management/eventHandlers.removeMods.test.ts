import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import type { VortexProfileId } from "@vortex/shared";

import { settle } from "../../test-utils/async";
import {
  makeDeploymentMethod,
  makeMod,
  makeProfileMod,
  makeRealDeploymentMethod,
  registerTestDeploymentMethod,
  registerTestModType,
} from "../../test-utils/builders";
import { makeApplyDeployedGame, makeDeployedGame } from "../../test-utils/deployedGame";
import { test } from "../../test-utils/harnessTest";
import type { IDeployedGameHarness } from "../../test-utils/harnessTypes";
import hardlinkInit from "../hardlink_activator";
import { profilesReducer } from "../profile_management/reducers/profiles";
import { type DeployProfile, onRemoveMods } from "./eventHandlers";
import type InstallManager from "./InstallManager";
import { sessionReducer } from "./reducers/session";
import { getAllActivators } from "./util/deploymentMethods";

const installManager = { markRecentRemoval: vi.fn() } as unknown as InstallManager;

/** Removes mods as the "remove-mods" event handler does. */
function removeMods(
  game: IDeployedGameHarness,
  modIds: string[],
  deployProfile: DeployProfile = vi.fn<DeployProfile>(),
) {
  return new Promise<void>((resolve, reject) =>
    onRemoveMods(
      game.api,
      getAllActivators(),
      installManager,
      deployProfile,
      game.gameId,
      modIds,
      (err) => (err == null ? resolve() : reject(err)),
    ),
  );
}

/** A game deploying through Apply with one enabled mod, "First", deployed and staged. */
async function makeApplyGameWithDeployedMod() {
  // removal disables the mods in the profile
  const game = await makeApplyDeployedGame(
    ["First"],
    [{ path: ["persistent", "profiles"], reducer: profilesReducer }],
  );
  game.setState((draft) => {
    draft.persistent.profiles[game.profileId].modState = {
      First: makeProfileMod({ enabled: true }),
    };
  });
  const stagedFolder = path.join(game.stagingPath, "First");
  /** What each deployment saw of the removed mod when it ran. */
  const deployments: {
    profileId: VortexProfileId;
    isModEnabled: boolean;
    isModStaged: boolean;
  }[] = [];
  const recordingDeploy: DeployProfile = (profileId) => {
    deployments.push({
      profileId,
      isModEnabled: game.api.getState().persistent.profiles[profileId].modState.First.enabled,
      isModStaged: existsSync(stagedFolder),
    });
    return Promise.resolve();
  };
  return { game, stagedFolder, deployments, recordingDeploy };
}

async function makeRemovalGame(methodId: string): Promise<IDeployedGameHarness> {
  const game = await makeDeployedGame({
    methodId,
    extraReducers: [{ path: ["session", "mods"], reducer: sessionReducer }],
  });
  // no last active profile, so removal skips disabling the mods
  game.setState((draft) => {
    draft.settings.profiles.lastActiveProfile = {};
  });
  return game;
}

test("removing a mod through Apply deploys the profile without it, then deletes its staging folder", async () => {
  const { game, stagedFolder, deployments, recordingDeploy } = await makeApplyGameWithDeployedMod();

  await removeMods(game, ["First"], recordingDeploy);

  expect(deployments).toEqual([
    { profileId: game.profileId, isModEnabled: false, isModStaged: true },
  ]);
  expect(existsSync(stagedFolder)).toBe(false);
  expect(game.api.getState().persistent.mods[game.gameId].First).toBeUndefined();
  // the recorded deployment leaves the game folder as it was
  expect(await game.recordedFiles()).toEqual(["First.esp"]);
});

test("a removal through Apply whose deployment fails keeps the mod and its staging folder", async () => {
  const { game, stagedFolder } = await makeApplyGameWithDeployedMod();

  await expect(
    removeMods(game, ["First"], () => Promise.reject(new Error("deployment failed"))),
  ).rejects.toThrow("deployment failed");

  expect(existsSync(stagedFolder)).toBe(true);
  expect(game.api.getState().persistent.mods[game.gameId].First).toBeDefined();
});

test("mods removed at the same time are all gone from the deployment manifest", async () => {
  const game = await makeRemovalGame("hardlink_activator");
  const method = makeRealDeploymentMethod(game.api, hardlinkInit);
  registerTestDeploymentMethod(method);
  await game.deployMods(method, ["First", "Second"]);

  await Promise.all([removeMods(game, ["First"]), removeMods(game, ["Second"])]);

  expect(await game.recordedFiles()).toEqual([]);
});

test("a removal failing for one mod type holds the next removal until its other types finish", async () => {
  const game = await makeRemovalGame("held-method");
  const secondTypePath = `${game.dataPath}-second`;
  await mkdir(secondTypePath, { recursive: true });
  registerTestModType("second-type", secondTypePath);
  game.setState((draft) => {
    draft.persistent.mods[game.gameId] = {
      Broken: makeMod({ id: "Broken", installationPath: "Broken" }),
      Slow: makeMod({ id: "Slow", installationPath: "Slow", type: "second-type" }),
      Next: makeMod({ id: "Next", installationPath: "Next" }),
    };
  });
  let releaseSlow: () => void;
  const slowHeld = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  const preparedPaths: string[] = [];
  const finalizedPaths: string[] = [];
  const method = makeDeploymentMethod({
    id: "held-method",
    prepare: (dataPath) => {
      preparedPaths.push(dataPath);
      return Promise.resolve();
    },
    deactivate: (sourcePath) =>
      path.basename(sourcePath) === "Broken"
        ? Promise.reject(new Error("broken mod"))
        : Promise.resolve(),
    finalize: async (_gameId, dataPath) => {
      finalizedPaths.push(dataPath);
      if (dataPath === secondTypePath) {
        await slowHeld;
      }
      return [];
    },
  });
  registerTestDeploymentMethod(method);

  const failing = removeMods(game, ["Broken", "Slow"]).catch((err: unknown) => err);
  const next = removeMods(game, ["Next"]);
  await vi.waitFor(() => expect(finalizedPaths).toContain(secondTypePath));
  await settle(100);
  // mod types prepare concurrently, so their order is not fixed
  const preparedBeforeRelease = [...preparedPaths].sort();
  releaseSlow();
  await Promise.all([failing, next]);

  expect(preparedBeforeRelease).toEqual([game.dataPath, secondTypePath].sort());
});
