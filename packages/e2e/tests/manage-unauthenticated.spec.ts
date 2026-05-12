import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";
import { test, expect } from "../fixtures/vortex-app";
import { manageGame, type ManagedGame } from "../helpers/games";
import { NavBar } from "../selectors/navbar";

test.describe("Games - Unauthenticated", () => {
  test(`[QA-106] user can attempt to manage a game without being logged in`, async ({
    vortexWindow,
  }) => {
    test.setTimeout(120_000);

    let managed: ManagedGame | null = null;

    try {
      managed = await manageGame(vortexWindow, "stardewvalley");

      const navbar = new NavBar(vortexWindow);
      await expect(navbar.modsLink).toBeVisible({ timeout: 15_000 });
    } finally {
      if (managed !== null) {
        cleanupFakeGame(managed.basePath);
      }
    }
  });
});
