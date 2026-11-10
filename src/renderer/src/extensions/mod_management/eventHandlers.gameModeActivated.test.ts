import { expect, vi } from "vitest";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { makeDeploymentMethod } from "../../test-utils/builders";
import { makeDeployedGame, makeHalfPurgedGame } from "../../test-utils/deployedGame";
import { test } from "../../test-utils/harnessTest";
import type { IDeployedGameHarness } from "../../test-utils/harnessTypes";
import { METHOD_UNAVAILABLE_NOTIFICATION_ID } from "./constants";
import { onGameModeActivated } from "./eventHandlers";
import { saveActivation } from "./util/activationStore";
import { registerDeploymentMethod } from "./util/deploymentMethods";

const unsupported = makeDeploymentMethod({
  id: "unsupported-method",
  priority: 2,
  isSupported: () => ({ description: () => "this method cannot deploy the game" }),
});
const replacement = makeDeploymentMethod({ id: "replacement-method" });
[unsupported, replacement].forEach(registerDeploymentMethod);

/** Activates a game its configured method doesn't support; resolves once a method is assigned. */
async function activate(game: IDeployedGameHarness) {
  onGameModeActivated(game.api, [unsupported, replacement], game.gameId);
  await vi.waitFor(() =>
    expect(game.dispatched).toContainEqual(
      expect.objectContaining({
        type: "SET_ACTIVATOR",
        payload: { gameId: game.gameId, activatorId: replacement.id },
      }),
    ),
  );
}

test("activating a game dismisses the unsupported method's notification once another method is assigned", async () => {
  const game = await makeDeployedGame({ methodId: unsupported.id, stagingTag: true });

  await activate(game);

  expect(game.errorNotifications.map((notification) => notification.title)).toContain(
    "Deployment method no longer supported",
  );
  expect(game.dismissedNotifications).toContain(METHOD_UNAVAILABLE_NOTIFICATION_ID);
});

test("replacing a deployment method keeps the files its purge left in the manifest", async () => {
  const game = await makeHalfPurgedGame(unsupported.id, { stagingTag: true });

  await activate(game);

  expect(await game.recordedFiles()).toEqual(["left-behind.esp"]);
});

test("replacing a deployment method leaves another instance's files out of this instance's manifest", async () => {
  const game = await makeDeployedGame({ methodId: unsupported.id, stagingTag: true });
  const otherInstances = await game.deployFile("left-behind.esp");
  await saveActivation(
    game.gameId,
    "",
    "other-instance",
    game.dataPath,
    game.stagingPath,
    [otherInstances],
    unsupported.id,
  );

  await activate(game);

  expect(await game.recordedFiles()).toEqual([]);
});
