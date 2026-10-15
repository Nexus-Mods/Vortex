import { VortexProfileId } from "@vortex/shared";
import { UserCanceled } from "@vortex/shared/errors";
import { describe, expect } from "vitest";

import { fireNotificationAction } from "../../actions/notifications";
import { makeProfile } from "../../test-utils/builders";
import type {
  IProfileSwitchHarness,
  IProfileSwitchOpts,
  ITrackedAction,
} from "../../test-utils/harnessTypes";
import { test } from "../../test-utils/profileSwitchTest";
import type { INotification } from "../../types/INotification";
import { PROFILE_SWITCH_FAILED_NOTIFICATION_ID } from "./constants";

const isNotification = (
  action: ITrackedAction,
): action is ITrackedAction & { payload: INotification } => action.type === "ADD_NOTIFICATION";

const skyrim1 = VortexProfileId("skyrim1");
const skyrim2 = VortexProfileId("skyrim2");

const failing = (profileId: VortexProfileId): IProfileSwitchOpts["failingDeploys"] => ({
  [profileId]: new Error("deployment failed"),
});

// fires the failure notification's first action the way the UI does and waits for the switch it starts
const switchBack = async (harness: IProfileSwitchHarness) => {
  const failure = harness.dispatched
    .filter(isNotification)
    .find((action) => action.payload.id === PROFILE_SWITCH_FAILED_NOTIFICATION_ID);
  expect(failure).toBeDefined();
  const switched = harness.profileChanged();
  fireNotificationAction(failure.payload.id, failure.payload.process, 0, () => {});
  await switched;
  return failure;
};

const profiles = [
  makeProfile({ id: "skyrim1", gameId: "skyrimse" }),
  makeProfile({ id: "skyrim2", gameId: "skyrimse" }),
  makeProfile({ id: "stardew1", gameId: "stardewvalley" }),
];
const lastActive = { skyrimse: "skyrim1", stardewvalley: "stardew1" };
const skyrimPending = { profiles, lastActive, needToDeploy: { skyrimse: true } };
// skyrim1 is active and the named profile's deployment fails
const skyrim1Failing = (failingDeploys: IProfileSwitchOpts["failingDeploys"]) => ({
  ...skyrimPending,
  activeProfileId: "skyrim1",
  failingDeploys,
});

describe("profile switch", () => {
  test("deploys both profiles when switching within the same game", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch({ ...skyrimPending, activeProfileId: "skyrim1" });

    await harness.switchTo("skyrim2");

    expect(harness.deployed).toEqual(["skyrim1", "skyrim2"]);
  });

  test("switches to another game's last active profile without deploying", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch({ ...skyrimPending, activeProfileId: "skyrim1" });

    await harness.switchTo("stardew1");

    expect(harness.deployed).toEqual([]);
    expect(harness.getState().persistent.deployment.needToDeploy.skyrimse).toBe(true);
    expect(
      harness.loggedMessages().filter((message) => /^(will|did) deploy/.test(message)),
    ).toEqual([]);
  });

  test("returns to a game's last active profile without deploying its pending changes", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch({ ...skyrimPending, activeProfileId: "stardew1" });

    await harness.switchTo("skyrim1");

    expect(harness.deployed).toEqual([]);
    expect(harness.getState().persistent.deployment.needToDeploy.skyrimse).toBe(true);
  });

  test("keeps the last active profile's pending changes when switching to another of its profiles", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch({
      ...skyrimPending,
      activeProfileId: "stardew1",
      gameSettings: { skyrimse: "undeployed:skyrim1" },
      savedSettings: { skyrim1: "undeployed:skyrim1" },
    });

    await harness.switchTo("skyrim2");

    expect(await harness.savedSettings("skyrim1")).toBe("deployed:skyrim1");
    expect(await harness.gameSettings("skyrimse")).toBe("deployed:skyrim2");
  });

  test("a failed deployment of the next profile leaves no profile active", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch(skyrim1Failing(failing(skyrim2)));

    await harness.switchTo("skyrim2");

    expect(harness.deployed).toEqual(["skyrim1", "skyrim2"]);
    expect(harness.getState().settings.profiles.activeProfileId).toBeUndefined();
  });

  test("a failed deployment of the previous profile leaves no profile active", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch(skyrim1Failing(failing(skyrim1)));

    await harness.switchTo("skyrim2");

    expect(harness.deployed).toEqual(["skyrim1"]);
    expect(harness.getState().settings.profiles.activeProfileId).toBeUndefined();
  });

  test("a deployment the user cancels cancels the switch without an error", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch(skyrim1Failing({ [skyrim2]: new UserCanceled() }));

    await harness.switchTo("skyrim2");

    expect(harness.getState().settings.profiles.activeProfileId).toBeUndefined();
    expect(harness.dispatched.filter(isNotification)).toEqual([]);
  });

  test("a failed switch offers to switch back to the previous profile", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch(skyrim1Failing(failing(skyrim2)));
    await harness.switchTo("skyrim2");

    const failure = await switchBack(harness);

    expect(failure.payload.actions[0].title).toBe("Switch back");
    expect(harness.getState().settings.profiles.activeProfileId).toBe("skyrim1");
    expect(harness.deployed).toEqual(["skyrim1", "skyrim2", "skyrim1"]);
  });

  test("a failed switch back still announces the end of the switch", async ({
    makeProfileSwitch,
  }) => {
    const harness = await makeProfileSwitch(skyrim1Failing(failing(skyrim1)));
    await harness.switchTo("skyrim2");

    await switchBack(harness);

    expect(harness.getState().settings.profiles.activeProfileId).toBeUndefined();
  });

  test("a later switch dismisses the failure notification", async ({ makeProfileSwitch }) => {
    const harness = await makeProfileSwitch(skyrim1Failing(failing(skyrim2)));
    await harness.switchTo("skyrim2");

    await harness.switchTo("skyrim1");

    expect(harness.getState().settings.profiles.activeProfileId).toBe("skyrim1");
    expect(harness.dispatched).toContainEqual(
      expect.objectContaining({
        type: "STOP_NOTIFICATION",
        payload: PROFILE_SWITCH_FAILED_NOTIFICATION_ID,
      }),
    );
  });

  test("deploys another profile of a game with nothing pending", async ({ makeProfileSwitch }) => {
    const harness = await makeProfileSwitch({
      profiles,
      lastActive,
      activeProfileId: "stardew1",
      gameSettings: { skyrimse: "deployed:skyrim1" },
      savedSettings: { skyrim1: "deployed:skyrim1" },
    });

    await harness.switchTo("skyrim2");

    expect(harness.deployed).toEqual(["skyrim2"]);
    expect(await harness.savedSettings("skyrim1")).toBe("deployed:skyrim1");
  });
});
