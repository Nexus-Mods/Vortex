import { cleanupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
/**
 * QA-113: user can add a new profile for the currently managed game.
 */
import { test, expect } from "../fixtures/vortex-app";
import { manageGame, type ManagedGame } from "../helpers/games";
import { NavBar } from "../selectors/navbar";
import { SettingsPage } from "../selectors/settings";
import { Spine } from "../selectors/spine";

test.describe("Profiles - Add", () => {
  test(`[QA-113] user can add a new profile for the current game`, async ({
    vortexApp,
    vortexWindow,
  }) => {
    test.setTimeout(120_000);

    const profileName = `QA-113 ${Date.now()}`;
    let managed: ManagedGame | null = null;

    try {
      managed = await manageGame(vortexWindow, "stardewvalley");
      const gameName = GAME_CONFIGS.stardewvalley!.gameName;

      await test.step("Enable Profile Management via global Settings", async () => {
        // Settings only appears in the home spine context, not per-game.
        const spine = new Spine(vortexWindow);
        await spine.homeButton.click();

        const navbar = new NavBar(vortexWindow);
        await expect(navbar.settingsLink).toBeVisible({ timeout: 10_000 });
        await navbar.settingsLink.click();

        const settings = new SettingsPage(vortexWindow);
        await settings.interfaceTab.click();

        const toggleRow = vortexWindow.locator(".toggle-container", {
          hasText: "Enable Profile Management",
        });
        await expect(toggleRow).toBeVisible({ timeout: 10_000 });

        const offToggle = toggleRow.locator(".toggle.toggle-off");
        if (await offToggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await offToggle.click();
        }
      });

      await test.step("Switch back to the game and open Profiles", async () => {
        const spine = new Spine(vortexWindow);
        await spine.gameButton(gameName).click();

        const navbar = new NavBar(vortexWindow);
        await expect(navbar.profilesLink).toBeVisible({ timeout: 10_000 });
        await navbar.profilesLink.click();
      });

      await test.step("Click Add Profile and enter a name", async () => {
        const addBtn = vortexWindow.getByRole("button", { name: /Add ".+" Profile/i }).first();
        await expect(addBtn).toBeVisible({ timeout: 10_000 });
        await addBtn.click();

        const nameInput = vortexWindow.locator(".profile-edit-panel input[type=text]");
        await expect(nameInput).toBeVisible({ timeout: 10_000 });
        await nameInput.fill(profileName);

        const saveBtn = vortexWindow.locator("#__accept");
        await expect(saveBtn).toBeEnabled();
        await saveBtn.click();
      });

      await test.step("Verify the new profile appears in the list", async () => {
        const newProfile = vortexWindow.getByText(profileName).first();
        await expect(newProfile).toBeVisible({ timeout: 15_000 });
      });
    } finally {
      if (managed !== null) {
        cleanupFakeGame(managed.basePath);
      }
    }
  });
});
