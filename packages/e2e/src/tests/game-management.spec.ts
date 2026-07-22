import { setupFakeGame, cleanupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
/**
 * Game management tests.
 * Uses fake game installations to avoid requiring real game installs.
 * Covers test cases: #8.1A, #8.8A
 */
import { test, expect } from "../fixtures/vortex-app";
import { manageGame } from "../helpers/games";
import { downloadModViaModManager } from "../helpers/modDownload";
import { SMAPI_MOD_URL, SMAPI_NAME } from "../helpers/mods";
import { navigateToGames } from "../helpers/navigation";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { GamesPage } from "../selectors/games";
import { LoginPage } from "../selectors/loginPage";
import { ModsPage } from "../selectors/modsPage";
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
    const config = GAME_CONFIGS.stardewvalley;

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

test.describe("Game Management - Manually set game location", () => {
  test.use({ nexusUser: freeUser });

  let fakeGame: { basePath: string; gamePath: string } | undefined;

  test.afterEach(() => {
    if (fakeGame !== undefined) {
      cleanupFakeGame(fakeGame.basePath);
      fakeGame = undefined;
    }
  });

  test("[QA-103] user can manually set a game location to manage it", async ({
    vortexApp,
    vortexWindow,
    nexusPage,
  }) => {
    const gamesPage = new GamesPage(vortexWindow);
    const navbar = new NavBar(vortexWindow);

    await test.step("Navigate to the Games page", async () => {
      await navigateToGames(vortexWindow);
      await expect(gamesPage.unmanagedSection).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("Stardew Valley is listed under Unmanaged", async () => {
      await expect(
        gamesPage.gameRowInSection(gamesPage.unmanagedSection, "Stardew Valley"),
      ).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    fakeGame = await manageGame(vortexWindow, vortexApp, "stardewvalley");

    await test.step("No error is shown", async () => {
      await expect(vortexWindow.getByText("Failed to manage game")).toBeHidden();
    });

    await test.step("Stardew Valley is the active game", async () => {
      await expect(
        vortexWindow.getByRole("button", { name: "Stardew Valley", exact: true }).first(),
      ).toBeVisible();
    });

    await test.step("Return to Home", async () => {
      await navbar.homeButton.click();
      await expect(navbar.gamesLink).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("Stardew Valley is now listed under Managed", async () => {
      await navbar.gamesLink.click();
      await expect(
        gamesPage.gameRowInSection(gamesPage.managedSection, "Stardew Valley"),
      ).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await downloadModViaModManager(nexusPage, vortexApp, SMAPI_MOD_URL);

    await test.step("Open the Stardew Valley workspace", async () => {
      await vortexWindow
        .getByRole("button", { name: "Stardew Valley", exact: true })
        .first()
        .click();
      await expect(navbar.modsLink).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("SMAPI is installed for the game", async () => {
      await navbar.modsLink.click();
      const modsPage = new ModsPage(vortexWindow);
      await expect(modsPage.row(SMAPI_NAME)).toBeVisible({ timeout: Timeouts.NETWORK });
    });
  });
});
