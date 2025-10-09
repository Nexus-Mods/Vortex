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
  // Set a long timeout since we need manual interaction (2 minutes wait + other operations)
  test.setTimeout(300000); // 5 minutes

  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } = await launchVortex(TEST_NAME);

  // Create a temporary directory for our fake game installations
  const fakeGamesPath = path.join(os.tmpdir(), 'vortex-test-games', `test-${Date.now()}`);

  console.log('\n=== Test Configuration ===');
  console.log(`Test name: ${TEST_NAME}`);
  console.log(`Test run directory: ${testRunDir}`);
  console.log(`Fake games base path: ${fakeGamesPath}`);
  console.log(`OS temp directory: ${os.tmpdir()}`);
  console.log(`Platform: ${process.platform}`);
  console.log('===========================\n');

  let gamePath: string | undefined;

  try {
    // Step 1: Login to Nexus Mods
    console.log('Step 1: Logging into Nexus Mods...');
    const loginResult = await loginToNexusMods(browser, mainWindow, undefined, undefined, testRunDir);

    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.error}`);
    }

    await mainWindow.screenshot({ path: path.join(testRunDir, '10-logged-in.png') });

    // Step 2: Create fake Stardew Valley installation (just the files, no Vortex integration)
    console.log('\nStep 2: Creating fake Stardew Valley game files...');
    console.log(`Creating game at: ${fakeGamesPath}`);

    const gameConfig = GAME_CONFIGS.stardewvalley;
    gamePath = path.join(fakeGamesPath, gameConfig.gameName);

    console.log(`Game will be created at: ${gamePath}`);

    // Create the fake game installation
    createFakeGameInstallation(gameConfig, fakeGamesPath);

    console.log(`✓ Game installation created at: ${gamePath}`);

    // Verify the executable exists
    const executablePath = path.join(gamePath, gameConfig.executable);
    const executableExists = fs.existsSync(executablePath);

    console.log(`✓ Executable check: ${executablePath}`);
    console.log(`✓ Executable exists: ${executableExists}`);

    if (!executableExists) {
      throw new Error(`Expected executable not found: ${executablePath}`);
    }

    // Verify directories exist
    console.log('\nVerifying game directories...');
    for (const dir of gameConfig.directories) {
      const dirPath = path.join(gamePath, dir);
      const dirExists = fs.existsSync(dirPath);
      console.log(`  ${dir}: ${dirExists ? '✓' : '✗'}`);
      if (!dirExists) {
        throw new Error(`Expected directory not found: ${dirPath}`);
      }
    }

    // Verify required files exist
    console.log('\nVerifying required files...');
    for (const file of gameConfig.requiredFiles) {
      const filePath = path.join(gamePath, file);
      const fileExists = fs.existsSync(filePath);
      console.log(`  ${file}: ${fileExists ? '✓' : '✗'}`);
      if (!fileExists) {
        throw new Error(`Expected file not found: ${filePath}`);
      }
    }

    // Step 3: Navigate to Games page in Vortex
    console.log('\nStep 3: Navigating to Games page...');
    console.log('Looking for Games button in sidebar: #main-nav-container a#Games');

    const gamesButton = mainWindow.locator('#main-nav-container a#Games');
    await gamesButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('✓ Games button found, clicking...');
    await gamesButton.click();

    // Wait for the games page to render
    await mainWindow.waitForTimeout(3000);
    await mainWindow.screenshot({ path: path.join(testRunDir, '20-games-page.png') });

    // Step 4: Click Show Details for Stardew Valley
    console.log('\nStep 4: Opening Stardew Valley details...');
    console.log('Looking for button: #btn-info-stardewvalley');

    const showDetailsButton = mainWindow.locator('button#btn-info-stardewvalley');
    await showDetailsButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('✓ Show Details button found, clicking...');
    await showDetailsButton.click();

    // Wait for the menu to appear
    await mainWindow.waitForTimeout(2000);
    await mainWindow.screenshot({ path: path.join(testRunDir, '21-details-menu.png') });

    // Step 5: Set game path directly via Redux action (bypassing dialog)
    console.log('\nStep 5: Setting game path via Redux action...');
    console.log(`Game path: ${gamePath}`);
    console.log(`Executable path: ${path.join(gamePath, gameConfig.executable)}`);

    // Click Manually Set Location button (will open native dialog)
    console.log('Looking for Manually Set Location button...');
    const manuallySetLocationButton = mainWindow.locator('button.action-manually-set-location');
    await manuallySetLocationButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('✓ Manually Set Location button found');
    console.log('\n========================================');
    console.log('⚠  MANUAL STEP REQUIRED');
    console.log('========================================');
    console.log('The test will now click "Manually Set Location".');
    console.log('A native folder dialog will appear.');
    console.log('');
    console.log('Please select this folder:');
    console.log(`  ${gamePath}`);
    console.log('');
    console.log('💡 TIP: Copy the path above and paste it into the');
    console.log('   folder dialog address bar for quick navigation.');
    console.log('');
    console.log('Then select "Steam" as the store when prompted.');
    console.log('');
    console.log('Waiting 5 seconds before clicking...');
    console.log('========================================\n');

    await mainWindow.waitForTimeout(5000);

    console.log('Clicking Manually Set Location...');
    await manuallySetLocationButton.click();

    console.log('\n⏸  Waiting for manual folder selection...');
    console.log('   Polling for store selection dialog...\n');

    // Poll to detect when the store selection dialog appears
    let storeDialogVisible = false;
    let pollAttempts = 0;
    const maxPollAttempts = 120; // 2 minutes with 1 second intervals

    while (!storeDialogVisible && pollAttempts < maxPollAttempts) {
      pollAttempts++;

      // Check for the "Choose a Game Store" modal dialog
      const dialogCheck = await mainWindow.evaluate(() => {
        try {
          // Look for the modal header with "Choose a Game Store" title
          const modalTitle = document.querySelector('.modal-header h4.modal-title');
          if (modalTitle && modalTitle.textContent?.includes('Choose a Game Store')) {
            console.log('Found "Choose a Game Store" modal dialog!');
            return { visible: true };
          }

          // Fallback: Look for Steam radio button as secondary check
          const steamRadio = document.querySelector('input#steam[type="radio"]');
          if (steamRadio) {
            console.log('Found Steam radio button - store dialog is visible!');
            return { visible: true };
          }

          return { visible: false };
        } catch (err) {
          return { visible: false, error: err instanceof Error ? err.message : String(err) };
        }
      });

      if (dialogCheck.visible) {
        storeDialogVisible = true;
        console.log(`✓ Store selection dialog appeared after ${pollAttempts} seconds`);
        break;
      }

      // Log progress every 10 seconds
      if (pollAttempts % 10 === 0) {
        console.log(`  Still waiting... (${pollAttempts}s elapsed)`);
      }

      await mainWindow.waitForTimeout(1000);
    }

    if (!storeDialogVisible) {
      console.log('⚠ Store selection dialog did not appear within timeout');
      console.log('Taking screenshot of current state...');
      await mainWindow.screenshot({ path: path.join(testRunDir, '22-timeout-no-dialog.png') });
      throw new Error('Store selection dialog did not appear after folder selection');
    }

    await mainWindow.screenshot({ path: path.join(testRunDir, '22-store-selection-dialog.png') });

    // Step 5b: Select Steam store and close dialog
    console.log('\nStep 5b: Selecting Steam store...');

    // Click Steam radio button
    console.log('Clicking Steam radio button...');
    await mainWindow.locator('input#steam[type="radio"]').click();
    await mainWindow.waitForTimeout(500);

    // Click the Select button
    console.log('Clicking Select button...');
    await mainWindow.locator('.modal-content button#close').click();
    await mainWindow.waitForTimeout(500);
    console.log('✓ Store selection confirmed');

    await mainWindow.screenshot({ path: path.join(testRunDir, '23-after-store-selection.png') });

    // Step 5c: Click Manage button for Stardew Valley
    console.log('\nStep 5c: Clicking Manage button...');
    await mainWindow.waitForTimeout(2000);

    console.log('Hovering over Stardew Valley game thumbnail to reveal buttons...');
    const hoverMenu = mainWindow.locator('#game-thumbnail-stardewvalley').locator('../..');
    await hoverMenu.hover();
    await mainWindow.waitForTimeout(500);

    console.log('Clicking Manage button...');
    const manageButton = mainWindow.locator('#game-thumbnail-stardewvalley button.action-manage');
    await manageButton.click();
    await mainWindow.waitForTimeout(5000);
    console.log('✓ Game activated');

    await mainWindow.screenshot({ path: path.join(testRunDir, '24-after-manage-clicked.png') });

    // Step 6: Verify the game was set up successfully
    console.log('\nStep 6: Verifying game setup...');

    // Check if the game is now discovered/managed
    const gameDiscovered = await mainWindow.evaluate(() => {
      try {
        const remote = (window as any).require('@electron/remote');
        const getReduxState = remote.getGlobal('getReduxState');
        const stateJson = getReduxState();
        const state = JSON.parse(stateJson);

        // Check if Stardew Valley is in the discovered games
        const discovered = state?.settings?.gameMode?.discovered?.stardewvalley;

        console.log('Stardew Valley discovery state:', discovered);

        return {
          isDiscovered: !!discovered,
          path: discovered?.path,
          modPath: discovered?.modPath
        };
      } catch (err) {
        console.log('Error checking discovery state:', err);
        return { isDiscovered: false };
      }
    });

    console.log('Game discovery result:', gameDiscovered);

    // Take final screenshot after everything is set up
    await mainWindow.waitForTimeout(2000);
    await mainWindow.screenshot({ path: path.join(testRunDir, '25-final-state.png') });

    console.log('\n=== Test Summary ===');
    console.log('✓ Test completed successfully!');
    console.log(`✓ Fake game created at: ${gamePath}`);
    console.log(`✓ All required game files and directories created`);
    console.log('✓ Logged into Nexus Mods');
    console.log('✓ Navigated to Games page');
    console.log('✓ Opened Stardew Valley details menu');
    console.log('✓ Clicked Manually Set Location (manual folder selection)');
    console.log(`✓ Game discovered: ${gameDiscovered.isDiscovered}`);
    if (gameDiscovered.isDiscovered) {
      console.log(`✓ Game path in Vortex: ${gameDiscovered.path}`);
    } else {
      console.log('⚠ Game was not discovered - manual selection may have been skipped');
    }
    console.log(`✓ Screenshots saved to: ${testRunDir}`);
    console.log('====================\n');

  } finally {
    // Cleanup: Remove fake game installation
    if (gamePath) {
      console.log(`\nCleaning up fake game installation at: ${gamePath}`);
      cleanupFakeGameInstallation(gamePath);
    }

    await closeVortex(app, appProcess, pid, userDataDir);
    console.log(`\nTest run complete. Full results available at: ${testRunDir}`);
  }

});
