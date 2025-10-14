/* eslint-disable max-lines-per-function */
import { test, Browser, expect } from '@playwright/test';
import { launchVortex, closeVortex } from '../src/vortex-helpers';
import { loginToNexusMods } from '../src/nexusmods-auth-helpers';
import {
  cleanupFakeGameInstallation,
  createFakeGameInstallation,
  GAME_CONFIGS,
} from '../src/game-setup-helpers';
import path from 'path';
import os from 'os';
import fs from 'fs';

const TEST_NAME = 'manage-fake-stardew-valley';

test('list available game configurations', () => {
  console.log('Available game configurations:');
  for (const [key, config] of Object.entries(GAME_CONFIGS)) {
    console.log(`  - ${key}: ${config.gameName}`);
    console.log(`    Executable: ${config.executable}`);
    console.log(`    Required files: ${config.requiredFiles.length}`);
    console.log(`    Directories: ${config.directories.length}`);
  }
});

test('manage fake Stardew Valley', async ({ browser }: { browser: Browser }) => {
  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } = await launchVortex(TEST_NAME);
  const fakeGamesPath = path.join(os.tmpdir(), 'vortex-test-games', `test-${Date.now()}`);
  const gameConfig = GAME_CONFIGS.stardewvalley;
  const gamePath = path.join(fakeGamesPath, gameConfig.gameName);

  console.log(`\nTest: ${TEST_NAME}`);
  console.log(`Screenshots: ${testRunDir}\n`);

  try {
    // Login to Nexus Mods
    console.log('1. Logging in...');
    const loginResult = await loginToNexusMods(browser, mainWindow, undefined, undefined, testRunDir);
    if (!loginResult.success) throw new Error(`Login failed: ${loginResult.error}`);

    // Create fake game installation
    console.log('2. Creating fake game files...');
    createFakeGameInstallation(gameConfig, fakeGamesPath);

    // Quick verification - just check executable
    if (!fs.existsSync(path.join(gamePath, gameConfig.executable))) {
      throw new Error(`Executable not created: ${gameConfig.executable}`);
    }

    // Navigate to Games page
    console.log('3. Opening Games page...');
    await mainWindow.locator('#main-nav-container a#Games').click();
    await mainWindow.waitForTimeout(1000);

    // Open Stardew Valley details
    console.log('4. Opening game details...');
    await mainWindow.locator('button#btn-info-stardewvalley').click();
    await mainWindow.waitForTimeout(1000);

    // Set game path programmatically
    console.log('5. Setting game path...');
    await mainWindow.evaluate((gamePath: string) => {
      (global as any).__VORTEX_TEST_GAME_PATH__ = gamePath;
    }, gamePath);

    // Click "Manually Set Location" - will use global variable
    await mainWindow.locator('button.action-manually-set-location').click();

    // Select Steam store
    await mainWindow.locator('input#steam[type="radio"]').click();
    await mainWindow.locator('.modal-content button#close').click();
    await mainWindow.waitForTimeout(1000);

    // Manage the game
    console.log('6. Activating game...');
    const gameThumbnail = mainWindow.locator('#game-thumbnail-stardewvalley');
    await gameThumbnail.locator('../..').hover();
    await gameThumbnail.locator('button.action-manage').click();
    await mainWindow.waitForTimeout(3000);

    // Verify game was discovered
    console.log('7. Verifying...');
    const isDiscovered = await mainWindow.evaluate(() => {
      const remote = (window as any).require('@electron/remote');
      const state = JSON.parse(remote.getGlobal('getReduxState')());
      return !!state?.settings?.gameMode?.discovered?.stardewvalley;
    });

    await mainWindow.screenshot({ path: path.join(testRunDir, 'final.png') });

    // Assert test passed
    expect(isDiscovered).toBe(true);
    console.log(`✓ Test passed - game discovered at: ${gamePath}\n`);

  } finally {
    cleanupFakeGameInstallation(gamePath);
    await closeVortex(app, appProcess, pid, userDataDir);
  }
});
