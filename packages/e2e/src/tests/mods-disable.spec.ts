import { test } from "../fixtures/vortex-app";
import {
  expectModDeployed,
  expectModStatus,
  installStardewTestMods,
  SDV_GAME_ID,
  TARGET_MOD_NAME,
} from "../helpers/mods";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { MOD_STATUS, ModsPage } from "../selectors/modsPage";

test.describe("Mods - Disable", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-245] free user can disable a mod and its files are undeployed", async ({
    vortexApp,
    vortexWindow,
    managedGame,
    nexusPage,
  }) => {
    await installStardewTestMods(nexusPage, vortexApp, vortexWindow);
    const modsPage = new ModsPage(vortexWindow);

    await test.step("The mod's files are deployed to the game folder", async () => {
      await expectModDeployed(managedGame.gamePath, SDV_GAME_ID, TARGET_MOD_NAME, true, {
        timeout: Timeouts.NETWORK,
      });
    });

    await test.step("Disable the mod", async () => {
      await modsPage.statusButtonInRow(TARGET_MOD_NAME).click();
      await expectModStatus(vortexWindow, TARGET_MOD_NAME, MOD_STATUS.disabled);
    });

    await test.step("The mod's files are removed from the game folder", async () => {
      await expectModDeployed(managedGame.gamePath, SDV_GAME_ID, TARGET_MOD_NAME, false, {
        timeout: Timeouts.NETWORK,
      });
    });
  });
});
