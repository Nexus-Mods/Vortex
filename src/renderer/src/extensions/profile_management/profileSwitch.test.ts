import { describe, expect } from "vitest";

import { makeProfile } from "../../test-utils/builders";
import { test } from "../../test-utils/profileSwitchTest";

const profiles = [
  makeProfile({ id: "skyrim1", gameId: "skyrimse" }),
  makeProfile({ id: "skyrim2", gameId: "skyrimse" }),
  makeProfile({ id: "stardew1", gameId: "stardewvalley" }),
];
const lastActive = { skyrimse: "skyrim1", stardewvalley: "stardew1" };
const skyrimPending = { profiles, lastActive, needToDeploy: { skyrimse: true } };

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
