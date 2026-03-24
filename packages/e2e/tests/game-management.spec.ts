/**
 * Game management tests.
 * Uses fake game installations to avoid requiring real game installs.
 * Covers test cases: #8.1A, #8.8A
 */
import { test, expect } from '../fixtures/vortex-app';
import { setupFakeGame, cleanupFakeGame, GAME_CONFIGS } from '../fixtures/game-setup/fake-game';
import { navigateToGames } from '../helpers/navigation';

test.describe('Game Management', () => {
  test('can list available games', async ({ vortexWindow }) => {
    await test.step('Navigate to Games page', async () => {
      await navigateToGames(vortexWindow);
    });

    await test.step('Verify games page has content', async () => {
      const bodyContent = await vortexWindow.locator('body').innerText();
      expect(bodyContent.length).toBeGreaterThan(0);
    });
  });

  test('fake game installation helper works', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const config = GAME_CONFIGS.stardewvalley;

    await test.step('Create fake game installation', async () => {
      const { basePath, gamePath } = setupFakeGame('stardewvalley');

      expect(fs.existsSync(path.join(gamePath, config.executable))).toBe(true);

      for (const dir of config.directories) {
        expect(fs.existsSync(path.join(gamePath, dir))).toBe(true);
      }

      cleanupFakeGame(basePath);
      expect(fs.existsSync(basePath)).toBe(false);
    });
  });
});
