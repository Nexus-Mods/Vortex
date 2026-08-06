import { expect, type ElectronApplication, type Page } from "@playwright/test";

import { setupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
import { test } from "../fixtures/vortex-app";
import { GamesPage } from "../selectors/games";
import { NavBar } from "../selectors/navbar";
import { stubOpenDialog } from "./dialogs";
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

    await expect(navbar.gamesLink).toBeVisible();
    await navbar.gamesLink.click();

    await stubOpenDialog(electronApp, fakeGame.gamePath);

    const row = gamesPage.gameRow(gameName);
    await expect(row).toBeVisible({ timeout: Timeouts.NETWORK });
    await row.scrollIntoViewIfNeeded();
    await row.hover();

    const manageButton = gamesPage.manageButton(gameName);
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    await expect(gamesPage.notDiscoveredDialog).toBeVisible();
    await expect(gamesPage.notDiscoveredDialog).toContainText(
      "hasn't been automatically discovered",
    );
    await gamesPage.continueButton.click();
    await expect(gamesPage.notDiscoveredDialog).toBeHidden();

    await expect(navbar.modsLink).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  return fakeGame;
}
