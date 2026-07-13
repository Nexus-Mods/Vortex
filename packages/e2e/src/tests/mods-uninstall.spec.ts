import type { ElectronApplication, Page } from "@playwright/test";

/**
 * QA-246: Mods [9.7] — I can uninstall a mod.
 *
 * Scenario 1 (two steps): remove the mod (archive kept), then remove again to
 * delete the archive — including a Cancel pass to prove nothing is removed.
 * Scenario 2 (one step): tick "Delete Archive" alongside "Remove Mod" and
 * remove both at once.
 *
 * Setup installs SMAPI first (the target mod depends on it), then the target
 * mod. The ticket's "verify the mod changes the main menu" step is skipped:
 * the fake-game fixture has no real launcher, so install/uninstall state is
 * asserted via the Mods list instead (same approach as QA-176).
 *
 * Uninstall behaviour is tier-independent (tier only affects the download
 * interstitial, covered by QA-108), so this runs as freeUser only.
 */
import { test, expect } from "../fixtures/vortex-app";
import { downloadModViaModManager } from "../helpers/modDownload";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { ConfirmRemovalDialog } from "../selectors/removeDialog";

const SMAPI_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";
const TARGET_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/4697";

const SMAPI_NAME = /SMAPI/i;
const TARGET_MOD_NAME = /Vintage Interface/i;

/** Install SMAPI, then the target mod, and land on the Mods page. */
async function installTestMods(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<void> {
  await downloadModViaModManager(nexusPage, vortexApp, SMAPI_MOD_URL);
  await downloadModViaModManager(nexusPage, vortexApp, TARGET_MOD_URL);

  await test.step("Open the Mods page", async () => {
    const navbar = new NavBar(vortexWindow);
    await navbar.modsLink.click();
    const modsPage = new ModsPage(vortexWindow);
    await expect(modsPage.row(SMAPI_NAME)).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  await test.step("The target mod is installed and enabled", async () => {
    const modsPage = new ModsPage(vortexWindow);
    await expect(modsPage.statusButtonInRow(TARGET_MOD_NAME)).toHaveText(/enabled/i, {
      timeout: Timeouts.NETWORK,
    });
  });
}

test.describe("Mods - Uninstall", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-246] free user can uninstall a mod in two steps", async ({
    vortexApp,
    vortexWindow,
    managedGame: _g,
    nexusPage,
  }) => {
    await installTestMods(nexusPage, vortexApp, vortexWindow);
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
      await expect(modsPage.statusButtonInRow(TARGET_MOD_NAME)).toHaveText(/enabled/i);
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
      await expect(modsPage.statusButtonInRow(TARGET_MOD_NAME)).toHaveText(/uninstalled/i, {
        timeout: Timeouts.NETWORK,
      });
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
  });

  test("[QA-246] free user can uninstall a mod and delete its archive in one step", async ({
    vortexApp,
    vortexWindow,
    managedGame: _g,
    nexusPage,
  }) => {
    await installTestMods(nexusPage, vortexApp, vortexWindow);
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
  });
});
