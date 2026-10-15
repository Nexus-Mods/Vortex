import { expect, type ElectronApplication, type Page } from "@playwright/test";

import { setupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
import { test } from "../fixtures/vortex-app";
import { GamesPage } from "../selectors/games";
import { NavBar } from "../selectors/navbar";
import { describeScreen } from "./diagnostics";
import { stubOpenDialog } from "./dialogs";
import { Timeouts } from "./timeouts";

// VORTEX_E2E=1 disables automatic discovery, so all games go through the
// "Game not discovered" dialog and have their path set via a dialog.showOpenDialog stub.
// A logged-in app may still list the game under "Games detected": that section comes
// from the user's store libraries via the Nexus API, and doesn't give Vortex a path.
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

    // First interaction after a cold app launch — allow the nav to finish
    // mounting rather than racing the default 5s UI budget.
    await expect(navbar.gamesLink).toBeVisible({ timeout: Timeouts.NETWORK });
    await navbar.gamesLink.click();

    await stubOpenDialog(electronApp, fakeGame.gamePath);

    const gamesPage = new GamesPage(vortexWindow);
    await addGameManually(gamesPage, gameName);

    try {
      await openAddedGame(gamesPage, navbar, gameName);
    } catch (e) {
      throw new Error(
        `${gameName} did not become the active game. On screen: ${await describeScreen(vortexWindow)}`,
        { cause: e },
      );
    }
  });

  return fakeGame;
}

/** Adds a game from "All supported games", answering the "Game not discovered" dialog. */
async function addGameManually(gamesPage: GamesPage, gameName: string): Promise<void> {
  // The supported games list is windowed, so the target game's tile isn't in
  // the DOM until the list is filtered down to it. Search by name first.
  await expect(gamesPage.searchInput).toBeVisible();
  await gamesPage.searchInput.fill(gameName);

  const tile = gamesPage.gameTileInSection(gamesPage.supportedSection, gameName);
  await expect(tile).toBeVisible({ timeout: Timeouts.NETWORK });
  // hover scrolls the tile into view itself, and unlike scrollIntoViewIfNeeded it
  // retries if the list re-renders the tile in the meantime
  await tile.hover();

  const manualAddButton = gamesPage.manualAddButton(gameName);
  await expect(manualAddButton).toBeVisible();
  await manualAddButton.click();

  await expect(gamesPage.notDiscoveredDialog).toBeVisible();
  await expect(gamesPage.notDiscoveredDialog).toContainText("hasn't been automatically discovered");
  await gamesPage.continueButton.click();
  await expect(gamesPage.notDiscoveredDialog).toBeHidden();
}

/**
 * Adding a game switches to its new profile, but the spine follows the open page,
 * so the user is left on the Games page in the Home workspace. The game's tile
 * moves to "Added games", and its Open goes to the Mods page.
 */
async function openAddedGame(
  gamesPage: GamesPage,
  navbar: NavBar,
  gameName: string,
): Promise<void> {
  const addedTile = gamesPage.gameTileInSection(gamesPage.addedSection, gameName);
  await expect(addedTile).toBeVisible({ timeout: Timeouts.GAME_ACTIVATION });
  await addedTile.hover();

  const openButton = gamesPage.openButton(gameName);
  await expect(openButton).toBeVisible();
  await openButton.click();

  await expect(navbar.modsLink).toBeVisible({ timeout: Timeouts.GAME_ACTIVATION });
}
