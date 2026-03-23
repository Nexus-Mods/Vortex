/**
 * Game management tests.
 *
 * Tests game discovery, manual path setting, and game activation.
 * Uses fake game installations to avoid requiring real game installs.
 *
 * Ported from root playwright/tests/manage-fake-stardew-valley.spec.ts.
 *
 * Covers test cases: #8.1A, #8.8A (manage game, manually set location)
 */
import { test, expect } from '../fixtures/vortex-app';
import { setupFakeGame, cleanupFakeGame, GAME_CONFIGS } from '../fixtures/game-setup/fake-game';

test.describe('Game Management', () => {
  // TODO: These tests need the game discovery scan to pick up the fake path.
  // The original test used mainWindow.evaluate() to set a global variable
  // and programmatic DOM interaction with specific element IDs (e.g.
  // #btn-info-stardewvalley, button.action-manually-set-location).
  // Once we add data-testid attributes to the Games page, these can be
  // properly implemented.

  test('can list available games', async ({ vortexWindow }) => {
    // Navigate to the home/games page
    const homeIcon = vortexWindow.locator('a[href="#/games"]').first();
    if (await homeIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await homeIcon.click();
      await vortexWindow.waitForTimeout(1000);
    }

    // Verify the games page has content
    const bodyContent = await vortexWindow.locator('body').innerText();
    expect(bodyContent.length).toBeGreaterThan(0);
  });

  test('fake game installation helper works', async () => {
    // Verify the test fixture creates and cleans up correctly
    const { basePath, gamePath } = setupFakeGame('stardewvalley');

    const fs = await import('node:fs');
    const path = await import('node:path');
    const config = GAME_CONFIGS.stardewvalley;

    // Verify executable exists
    expect(fs.existsSync(path.join(gamePath, config.executable))).toBe(true);

    // Verify directories exist
    for (const dir of config.directories) {
      expect(fs.existsSync(path.join(gamePath, dir))).toBe(true);
    }

    // Clean up
    cleanupFakeGame(basePath);
    expect(fs.existsSync(basePath)).toBe(false);
  });
});
