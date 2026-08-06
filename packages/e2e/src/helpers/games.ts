import { expect, type ElectronApplication, type Page } from "@playwright/test";

import { setupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
import { test } from "../fixtures/vortex-app";
import { GamesPage } from "../selectors/games";
import { NavBar } from "../selectors/navbar";
import { Timeouts } from "./timeouts";

// VORTEX_E2E=1 disables automatic discovery, so all games go through the
// "Game not discovered" dialog and have their path set via a dialog.showOpenDialog stub.
export type ManagedGameId = "stardewvalley";

export interface ManagedGame {
  basePath: string;
  gamePath: string;
}

export async function manageGame(
  vortexWindow: Page,
  electronApp: ElectronApplication,
  gameId: ManagedGameId,
): Promise<ManagedGame> {
  const fakeGame = setupFakeGame(gameId);
  const gameName = GAME_CONFIGS[gameId].gameName;

  await test.step(`Manage game: ${gameId}`, async () => {
    const navbar = new NavBar(vortexWindow);
    const gamesPage = new GamesPage(vortexWindow);

    // First interaction after a cold app launch — allow the nav to finish
    // mounting rather than racing the default 5s UI budget.
    await expect(navbar.gamesLink).toBeVisible({ timeout: Timeouts.NETWORK });
    await navbar.gamesLink.click();

    await electronApp.evaluate(({ dialog }, gamePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [gamePath] });
    }, fakeGame.gamePath);

    // The unmanaged games list is paginated/windowed, so the target game's row
    // isn't in the DOM until the list is filtered down to it. Search by name first.
    await expect(gamesPage.searchInput).toBeVisible();
    await gamesPage.searchInput.fill(gameName);

    const row = gamesPage.gameRow(gameName);
    await expect(row).toBeVisible({ timeout: Timeouts.NETWORK });
    await row.scrollIntoViewIfNeeded();
    await row.hover();

    const manageButton = gamesPage.manageButton(gameName);
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    const continueButton = vortexWindow.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    await expect(navbar.modsLink).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  return fakeGame;
}
