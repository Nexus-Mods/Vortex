import { setupFakeGame, cleanupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
/**
 * Game management tests.
 * Uses fake game installations to avoid requiring real game installs.
 * Covers test cases: #8.1A, #8.8A
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToGames } from "../helpers/navigation";
import { LoginPage } from "../selectors/loginPage";
import { NavBar } from "../selectors/navbar";

test.describe("Game Management", () => {
  test("can list available games", async ({ vortexWindow }) => {
    await test.step("Navigate to Games page", async () => {
      await navigateToGames(vortexWindow);
    });

    await test.step("Verify games page has content", async () => {
      const bodyContent = await vortexWindow.locator("body").innerText();
      expect(bodyContent.length).toBeGreaterThan(0);
    });
  });

  test("fake game installation helper works", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const config = GAME_CONFIGS.stardewvalley!;

    await test.step("Create fake game installation", () => {
      const { basePath, gamePath } = setupFakeGame("stardewvalley");

      expect(fs.existsSync(path.join(gamePath, config.executable))).toBe(true);

      for (const dir of config.directories) {
        expect(fs.existsSync(path.join(gamePath, dir))).toBe(true);
      }

      cleanupFakeGame(basePath);
      expect(fs.existsSync(basePath)).toBe(false);
    });
  });

  test("[QA-106] can manage a game while not logged in", async ({
    vortexWindow,
    managedGame: _g,
  }) => {
    await test.step("App is signed out", async () => {
      const loginPage = new LoginPage(vortexWindow);
      await expect(loginPage.vortexLoginButton).toBeVisible();
    });

    await test.step("Mods page is reachable for the managed game", async () => {
      const navbar = new NavBar(vortexWindow);
      await expect(navbar.modsLink).toBeVisible();
    });
  });
});
