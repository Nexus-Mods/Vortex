/* eslint-disable max-lines-per-function */
import type { Browser } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { launchVortex, closeVortex } from "../src/vortex-helpers";
import {
  loginToNexusModsWithRealChrome,
  downloadModFromNexus,
  buildModDownloadPopupUrl,
} from "../src/nexusmods-auth-helpers";
import {
  cleanupFakeGameInstallation,
  createFakeGameInstallation,
  GAME_CONFIGS,
} from "../src/game-setup-helpers";
import { closeRealChrome } from "../src/chrome-browser-helpers";
import { constants } from "../src/constants";
import path from "path";
import os from "os";
import fs from "fs";

const TEST_NAME = "manage-fake-stardew-valley";

test("list available game configurations", () => {
  console.log("Available game configurations:");
  for (const [key, config] of Object.entries(GAME_CONFIGS)) {
    console.log(`  - ${key}: ${config.gameName}`);
    console.log(`    Executable: ${config.executable}`);
    console.log(`    Required files: ${config.requiredFiles.length}`);
    console.log(`    Directories: ${config.directories.length}`);
  }
});

test("manage fake Stardew Valley", async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(180000); // 3 minutes timeout for manual captcha + protocol prompt

  // Clean up any leftover directories from previous failed test runs
  console.log("Cleaning up old test directories...");
  const appdataDir =
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const testDirPattern = `vortex_playwright_${TEST_NAME}_`;

  try {
    const entries = fs.readdirSync(appdataDir);
    const oldTestDirs = entries.filter((entry) =>
      entry.startsWith(testDirPattern),
    );

    for (const dirName of oldTestDirs) {
      const dirPath = path.join(appdataDir, dirName);
      try {
        const stats = fs.statSync(dirPath);
        if (stats.isDirectory()) {
          console.log(`  Removing old directory: ${dirName}`);
          fs.rmSync(dirPath, {
            recursive: true,
            force: true,
            maxRetries: 3,
            retryDelay: 1000,
          });
        }
      } catch (e) {
        console.warn(`  Could not remove ${dirName}: ${e}`);
      }
    }

    if (oldTestDirs.length === 0) {
      console.log("  No old directories found");
    } else {
      // Give Windows time to fully release file handles after cleanup
      console.log("  Waiting for file handles to release...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.warn(`  Error during cleanup: ${e}`);
  }

  const { app, mainWindow, testRunDir, appProcess, pid, userDataDir } =
    await launchVortex(TEST_NAME);
  const fakeGamesPath = path.join(
    os.tmpdir(),
    "vortex-test-games",
    `test-${Date.now()}`,
  );
  const gameConfig = GAME_CONFIGS.stardewvalley;
  const gamePath = path.join(fakeGamesPath, gameConfig.gameName);

  console.log(`\nTest: ${TEST_NAME}`);
  console.log(`Screenshots: ${testRunDir}\n`);

  let loginResult;

  try {
    // Login to Nexus Mods using real Chrome browser
    console.log("1. Logging in to Nexus Mods (production)...");
    loginResult = await loginToNexusModsWithRealChrome(mainWindow, testRunDir);
    if (!loginResult.success)
      throw new Error(`Login failed: ${loginResult.error}`);

    // Create fake game installation
    console.log("2. Creating fake game files...");
    createFakeGameInstallation(gameConfig, fakeGamesPath);

    // Quick verification - just check executable
    if (!fs.existsSync(path.join(gamePath, gameConfig.executable))) {
      throw new Error(`Executable not created: ${gameConfig.executable}`);
    }

    // Navigate to Games page
    console.log("3. Opening Games page...");
    await mainWindow.locator("#main-nav-container a#Games").click();
    await mainWindow.waitForTimeout(1000);

    // Open Stardew Valley details
    console.log("4. Opening game details...");
    await mainWindow.locator("button#btn-info-stardewvalley").click();
    await mainWindow.waitForTimeout(1000);

    // Set game path programmatically
    console.log("5. Setting game path...");
    await mainWindow.evaluate((gamePath: string) => {
      (global as any).__VORTEX_TEST_GAME_PATH__ = gamePath;
    }, gamePath);

    // Click "Manually Set Location" - will use global variable
    await mainWindow.locator("button.action-manually-set-location").click();

    // Select Steam store
    await mainWindow.locator('input#steam[type="radio"]').click();
    await mainWindow.locator(".modal-content button#close").click();
    await mainWindow.waitForTimeout(1000);

    // Manage the game
    console.log("6. Activating game...");
    const gameThumbnail = mainWindow.locator("#game-thumbnail-stardewvalley");
    await gameThumbnail.locator("../..").hover();
    await gameThumbnail.locator("button.action-manage").click();
    await mainWindow.waitForTimeout(3000);

    // Verify game was discovered
    console.log("7. Verifying...");
    const isDiscovered = await mainWindow.evaluate(() => {
      const remote = (window as any).require("@electron/remote");
      const state = JSON.parse(remote.getGlobal("getReduxState")());
      return !!state?.settings?.gameMode?.discovered?.stardewvalley;
    });

    await mainWindow.screenshot({ path: path.join(testRunDir, "final.png") });

    // Assert test passed
    expect(isDiscovered).toBe(true);
    console.log(`✓ Test passed - game discovered at: ${gamePath}\n`);

    // Download a mod using the authenticated browser context
    if (loginResult.browserContext) {
      console.log("8. Downloading mod from Nexus Mods (production)...");
      console.log(`   Browser object exists: ${!!loginResult.browser}`);
      console.log(`   Browser context exists: ${!!loginResult.browserContext}`);

      // Build download popup URL from constants
      const modUrl = buildModDownloadPopupUrl(
        constants.TEST_MODS.STARDEW_VALLEY.fileId,
        constants.TEST_MODS.STARDEW_VALLEY.gameId,
      );
      console.log(`   Download Popup URL: ${modUrl}`);

      // Check Vortex download state before download
      const downloadsBefore = await mainWindow.evaluate(() => {
        const remote = (window as any).require("@electron/remote");
        const state = JSON.parse(remote.getGlobal("getReduxState")());
        return {
          downloadCount: Object.keys(state?.persistent?.downloads?.files || {})
            .length,
          downloads: state?.persistent?.downloads?.files,
        };
      });
      console.log(
        `   Downloads in Vortex before: ${downloadsBefore.downloadCount}`,
      );

      const downloadSuccess = await downloadModFromNexus(
        loginResult.browserContext,
        modUrl,
        testRunDir,
      );

      if (downloadSuccess) {
        console.log("✓ Mod download initiated in browser\n");

        // Wait for Vortex to receive and process the NXM link
        await mainWindow.waitForTimeout(3000);

        // Navigate to Downloads page to see the download
        console.log("9. Navigating to Downloads page...");
        await mainWindow.locator("#main-nav-container a#Downloads").click();
        await mainWindow.waitForTimeout(2000);

        // Check Vortex download state after download
        const downloadsAfter = await mainWindow.evaluate(() => {
          const remote = (window as any).require("@electron/remote");
          const state = JSON.parse(remote.getGlobal("getReduxState")());
          const downloads = state?.persistent?.downloads?.files || {};
          return {
            downloadCount: Object.keys(downloads).length,
            downloads: Object.values(downloads).map((d: any) => ({
              id: d.id,
              game: d.game,
              modInfo: d.modInfo,
              state: d.state,
              localPath: d.localPath,
            })),
          };
        });

        console.log(
          `   Downloads in Vortex after: ${downloadsAfter.downloadCount}`,
        );

        if (downloadsAfter.downloadCount > downloadsBefore.downloadCount) {
          console.log("✅ Vortex received the NXM link and started download!");
          console.log(
            "   Download details:",
            JSON.stringify(
              downloadsAfter.downloads[downloadsAfter.downloads.length - 1],
              null,
              2,
            ),
          );
        } else {
          console.warn(
            "⚠️  Vortex did not receive the NXM link or download did not start",
          );
          console.log(
            "   Current downloads:",
            JSON.stringify(downloadsAfter.downloads, null, 2),
          );
        }
      } else {
        console.warn("⚠ Mod download may have failed in browser\n");
      }
    }
  } finally {
    // Clean up Chrome instance (this also closes the browser context)
    // NOTE: Don't close browserContext separately - it's the default context from CDP
    // and closing it would disconnect from Chrome prematurely
    if (loginResult?.chromeInstance) {
      try {
        await closeRealChrome(loginResult.chromeInstance);
      } catch (e) {
        console.error("Failed to close Chrome:", e);
      }
    }

    cleanupFakeGameInstallation(gamePath);
    await closeVortex(app, appProcess, pid, userDataDir);
  }
});
