import { expect, type Page } from "@playwright/test";

import { setupFakeGame, GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
import { test } from "../fixtures/vortex-app";
import { GamesPage } from "../selectors/games";
import { NavBar } from "../selectors/navbar";
import { Timeouts } from "./timeouts";

// Only auto-discoverable games are supported today. Skyrim SE goes through
// Vortex's manual-discovery dialog flow which our fake-game install isn't
// rich enough to satisfy yet (TODO: add when fake-game produces a real PE
// header with version info, or expose a stronger Vortex test hook).
export type ManagedGameId = "stardewvalley";

export interface ManagedGame {
  basePath: string;
  gamePath: string;
}

export async function manageGame(vortexWindow: Page, gameId: ManagedGameId): Promise<ManagedGame> {
  const fakeGame = setupFakeGame(gameId);
  const gameName = GAME_CONFIGS[gameId]!.gameName;

  await test.step(`Manage game: ${gameId}`, async () => {
    const navbar = new NavBar(vortexWindow);
    const gamesPage = new GamesPage(vortexWindow);

    await expect(navbar.gamesLink).toBeVisible();
    await navbar.gamesLink.click();

    await vortexWindow.evaluate((path) => {
      const slot = globalThis as {
        __VORTEX_TEST_GAME_PATH__?: string;
        global?: { __VORTEX_TEST_GAME_PATH__?: string };
      };
      slot.__VORTEX_TEST_GAME_PATH__ = path;
      if (slot.global !== undefined) {
        slot.global.__VORTEX_TEST_GAME_PATH__ = path;
      }
    }, fakeGame.gamePath);

    const row = gamesPage.gameRow(gameName);
    await expect(row).toBeVisible({ timeout: Timeouts.NETWORK });
    await row.scrollIntoViewIfNeeded();
    await row.hover();

    const manageButton = gamesPage.manageButton(gameName);
    await expect(manageButton).toBeVisible();
    await manageButton.click();

    await expect(navbar.modsLink).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  return fakeGame;
}
