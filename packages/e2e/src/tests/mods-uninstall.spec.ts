import { test, expect } from "../fixtures/vortex-app";
import {
  expectArchiveOnDisk,
  expectModStatus,
  installStardewTestMods,
  SDV_GAME_ID,
  TARGET_MOD_NAME,
} from "../helpers/mods";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { MOD_STATUS, ModsPage } from "../selectors/modsPage";
import { ConfirmRemovalDialog } from "../selectors/removeDialog";

test.describe("Mods - Uninstall", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-246] free user can uninstall a mod in two steps", async ({
    vortexApp,
    vortexWindow,
    vortexUserDataDir,
    managedGame: _g,
    nexusPage,
  }) => {
    await installStardewTestMods(nexusPage, vortexApp, vortexWindow);
    const modsPage = new ModsPage(vortexWindow);
    const dialog = new ConfirmRemovalDialog(vortexWindow);

    await test.step("Click Remove on the target mod's row", async () => {
      await modsPage.row(TARGET_MOD_NAME).hover();
      await modsPage.removeButtonInRow(TARGET_MOD_NAME).click();
      await expect(dialog.root).toBeVisible();
    });

    await test.step("'Remove Mod' is pre-checked", async () => {
      await expect(dialog.removeModCheckbox).toBeChecked();
    });

    await test.step("'Delete Archive' is unchecked", async () => {
      await expect(dialog.deleteArchiveCheckbox).not.toBeChecked();
    });

    await test.step("Cancel closes the dialog", async () => {
      await dialog.cancelButton.click();
      await expect(dialog.root).toBeHidden();
    });

    await test.step("The mod is still installed and enabled", async () => {
      await expectModStatus(vortexWindow, TARGET_MOD_NAME, MOD_STATUS.enabled);
    });

    await test.step("Open the removal dialog again", async () => {
      await modsPage.row(TARGET_MOD_NAME).hover();
      await modsPage.removeButtonInRow(TARGET_MOD_NAME).click();
      await expect(dialog.root).toBeVisible();
    });

    await test.step("Remove the mod, keeping the archive", async () => {
      await dialog.removeButton.click();
      await expect(dialog.root).toBeHidden();
    });

    await test.step("The mod is uninstalled but its archive remains", async () => {
      await expectModStatus(vortexWindow, TARGET_MOD_NAME, MOD_STATUS.uninstalled, {
        timeout: Timeouts.NETWORK,
      });
    });

    await test.step("The archive is still on disk", async () => {
      await expectArchiveOnDisk(vortexUserDataDir, SDV_GAME_ID, TARGET_MOD_NAME, true);
    });

    await test.step("Open the removal dialog for the archive", async () => {
      await modsPage.row(TARGET_MOD_NAME).hover();
      await modsPage.removeButtonInRow(TARGET_MOD_NAME).click();
      await expect(dialog.root).toBeVisible();
    });

    await test.step("'Delete Archive' is now pre-checked", async () => {
      await expect(dialog.deleteArchiveCheckbox).toBeChecked();
    });

    await test.step("'Remove Mod' checkbox is no longer offered", async () => {
      await expect(dialog.removeModCheckbox).toBeHidden();
    });

    await test.step("Delete the archive", async () => {
      await dialog.removeButton.click();
      await expect(dialog.root).toBeHidden();
    });

    await test.step("The mod is gone from the Mods list", async () => {
      await expect(modsPage.row(TARGET_MOD_NAME)).toBeHidden({ timeout: Timeouts.NETWORK });
    });

    await test.step("The archive is deleted from disk", async () => {
      await expectArchiveOnDisk(vortexUserDataDir, SDV_GAME_ID, TARGET_MOD_NAME, false, {
        timeout: Timeouts.NETWORK,
      });
    });
  });

  test("[QA-246] free user can uninstall a mod and delete its archive in one step", async ({
    vortexApp,
    vortexWindow,
    vortexUserDataDir,
    managedGame: _g,
    nexusPage,
  }) => {
    await installStardewTestMods(nexusPage, vortexApp, vortexWindow);
    const modsPage = new ModsPage(vortexWindow);
    const dialog = new ConfirmRemovalDialog(vortexWindow);

    await test.step("The archive is on disk", async () => {
      await expectArchiveOnDisk(vortexUserDataDir, SDV_GAME_ID, TARGET_MOD_NAME, true);
    });

    await test.step("Click Remove on the target mod's row", async () => {
      await modsPage.row(TARGET_MOD_NAME).hover();
      await modsPage.removeButtonInRow(TARGET_MOD_NAME).click();
      await expect(dialog.root).toBeVisible();
    });

    await test.step("'Remove Mod' is pre-checked", async () => {
      await expect(dialog.removeModCheckbox).toBeChecked();
    });

    await test.step("Check 'Delete Archive' as well", async () => {
      await dialog.deleteArchiveCheckbox.check();
      await expect(dialog.deleteArchiveCheckbox).toBeChecked();
    });

    await test.step("Remove the mod and its archive", async () => {
      await dialog.removeButton.click();
      await expect(dialog.root).toBeHidden();
    });

    await test.step("The mod is gone from the Mods list", async () => {
      await expect(modsPage.row(TARGET_MOD_NAME)).toBeHidden({ timeout: Timeouts.NETWORK });
    });

    await test.step("The archive is deleted from disk", async () => {
      await expectArchiveOnDisk(vortexUserDataDir, SDV_GAME_ID, TARGET_MOD_NAME, false, {
        timeout: Timeouts.NETWORK,
      });
    });
  });
});
